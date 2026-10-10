'use strict';

const request = require('supertest');
const fc = require('fast-check');
const { computeReadiness, TOTAL_SECTIONS, TEXT_FIELDS, isTextComplete } = require('../server/utils/readiness');
const { setupTestDB, teardownTestDB, clearDatabase, getApp, createAuthenticatedAgent } = require('./test-helper');
const BusinessProfile = require('../server/models/BusinessProfile');
const EvidenceRecord = require('../server/models/EvidenceRecord');

let app;

beforeAll(async () => {
  const setup = await setupTestDB();
  app = setup.app;
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearDatabase();
});

describe('Readiness Calculation & Endpoint', () => {
  describe('Unit Tests: computeReadiness() pure function', () => {
    it('should return 0% when all fields are empty/null and no evidence records', () => {
      const emptyProfile = {
        businessName: '',
        description: '',
        industry: '',
        stage: '',
        businessModel: '',
        problemStatement: '',
        solutionStatement: '',
        targetCustomers: '',
        revenueContext: '',
        fundingGoal: null,
        useOfFunds: '',
        milestones: ''
      };
      const result = computeReadiness(emptyProfile, false);
      expect(result.completed).toBe(0);
      expect(result.total).toBe(13);
      expect(result.percentage).toBe(0);
      expect(result.incompleteItems.length).toBe(13);
    });

    it('should return 100% when all 13 sections are complete', () => {
      const fullProfile = {
        businessName: 'Acme Corp',
        description: 'Solving big problems',
        industry: 'B2B SaaS',
        stage: 'Seed',
        businessModel: 'Subscription',
        problemStatement: 'Manual workflows are slow',
        solutionStatement: 'Automated AI platform',
        targetCustomers: 'SMB Enterprises',
        revenueContext: ' ARR growing 20% MoM',
        fundingGoal: 1000000,
        useOfFunds: 'Engineering and Sales hiring',
        milestones: 'Launch v2.0, reach 100 customers'
      };
      const result = computeReadiness(fullProfile, true);
      expect(result.completed).toBe(13);
      expect(result.total).toBe(13);
      expect(result.percentage).toBe(100);
      expect(result.incompleteItems.length).toBe(0);
    });

    it('should calculate partial scores accurately matching Math.round((completed/13)*100)', () => {
      const partialProfile = {
        businessName: 'Acme',
        description: 'Some desc',
        industry: '',
        stage: '',
        businessModel: '',
        problemStatement: '',
        solutionStatement: '',
        targetCustomers: '',
        revenueContext: '',
        fundingGoal: null,
        useOfFunds: '',
        milestones: ''
      };
      // 2 completed text fields out of 13
      const result = computeReadiness(partialProfile, false);
      expect(result.completed).toBe(2);
      expect(result.percentage).toBe(Math.round((2 / 13) * 100)); // 15%
    });

    it('should treat whitespace-only strings as incomplete', () => {
      const whitespaceProfile = {
        businessName: '   ',
        description: '\t\n  ',
        industry: '   ',
        stage: '',
        businessModel: '  ',
        problemStatement: '',
        solutionStatement: '',
        targetCustomers: '',
        revenueContext: '',
        fundingGoal: null,
        useOfFunds: '',
        milestones: ''
      };
      const result = computeReadiness(whitespaceProfile, false);
      expect(result.completed).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('should handle fundingGoal edge cases: 0 is incomplete, 0.01 is complete', () => {
      const pZero = { fundingGoal: 0 };
      expect(computeReadiness(pZero, false).completed).toBe(0);

      const pNegative = { fundingGoal: -500 };
      expect(computeReadiness(pNegative, false).completed).toBe(0);

      const pValid = { fundingGoal: 0.01 };
      expect(computeReadiness(pValid, false).completed).toBe(1);
    });
  });

  describe('GET /api/readiness/:profileId Endpoint', () => {
    it('should return readiness report for a profile owned by Founder', async () => {
      const { agent, user } = await createAuthenticatedAgent({ role: 'Founder' });
      const createRes = await agent.post('/api/profiles').send({
        businessName: 'My Startup',
        description: 'My Description',
        industry: 'FinTech',
        fundingGoal: 500000
      });
      const profileId = createRes.body.profile._id;

      const res = await agent.get('/api/readiness/' + profileId);
      expect(res.status).toBe(200);
      expect(res.body.totalSections).toBe(13);
      expect(res.body.completedCount).toBe(4); // businessName, description, industry, fundingGoal
      expect(res.body.completenessPercentage).toBe(Math.round((4 / 13) * 100));
      expect(res.body.incompleteItems).toBeDefined();
    });

    it('should return 403 when a Founder tries to access another Founder profile readiness', async () => {
      const founder1 = await createAuthenticatedAgent({ role: 'Founder', email: 'f1@test.com' });
      const founder2 = await createAuthenticatedAgent({ role: 'Founder', email: 'f2@test.com' });

      const createRes = await founder1.agent.post('/api/profiles').send({
        businessName: 'Startup 1',
        description: 'Desc 1'
      });
      const profileId = createRes.body.profile._id;

      const res = await founder2.agent.get('/api/readiness/' + profileId);
      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent profile ID', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const fakeId = new BusinessProfile()._id;
      const res = await agent.get('/api/readiness/' + fakeId);
      expect(res.status).toBe(404);
    });
  });

  describe('Property-Based Tests for Readiness', () => {
    // Feature: venture-lens, Property 1: Completeness formula is (completed / 13) * 100 rounded
    it('Property 1: Completeness formula is (completed / 13) * 100 rounded (100 runs)', () => {
      fc.assert(
        fc.property(
          fc.record({
            businessName: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            description: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            industry: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            stage: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            businessModel: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            problemStatement: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            solutionStatement: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            targetCustomers: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            revenueContext: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            useOfFunds: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            milestones: fc.oneof(fc.constant(''), fc.constant('   '), fc.string({ minLength: 1 })),
            fundingGoal: fc.oneof(fc.constant(null), fc.constant(0), fc.double({ min: 0.01, max: 10000000 })),
            hasEvidence: fc.boolean()
          }),
          (data) => {
            const { hasEvidence, ...profile } = data;
            const result = computeReadiness(profile, hasEvidence);

            expect(result.total).toBe(13);
            expect(result.completed).toBeGreaterThanOrEqual(0);
            expect(result.completed).toBeLessThanOrEqual(13);
            expect(result.percentage).toBe(Math.round((result.completed / 13) * 100));
            expect(result.percentage).toBeGreaterThanOrEqual(0);
            expect(result.percentage).toBeLessThanOrEqual(100);
            expect(result.incompleteItems.length).toBe(13 - result.completed);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: venture-lens, Property 2: Whitespace-only fields are treated as incomplete
    it('Property 2: Whitespace-only fields are treated as incomplete (100 runs)', () => {
      const whitespaceGen = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'));

      fc.assert(
        fc.property(whitespaceGen, (ws) => {
          TEXT_FIELDS.forEach(field => {
            const profileWithWs = { [field]: ws };
            const profileEmpty = { [field]: '' };

            const resWs = computeReadiness(profileWithWs, false);
            const resEmpty = computeReadiness(profileEmpty, false);

            expect(resWs.completed).toBe(resEmpty.completed);
            expect(resWs.percentage).toBe(resEmpty.percentage);
          });
        }),
        { numRuns: 100 }
      );
    });
  });
});
