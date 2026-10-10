'use strict';

const request = require('supertest');
const fc = require('fast-check');
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

describe('Evidence Record Routes & Isolation', () => {
  describe('Founder CRUD Operations', () => {
    it('should create an evidence record with 201 when inputs and ownership are valid', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const pRes = await agent.post('/api/profiles').send({
        businessName: 'Evidence Test Co',
        description: 'Testing evidence'
      });
      const profileId = pRes.body.profile._id;

      const res = await agent.post('/api/evidence').send({
        profileId,
        title: 'Audited Financials 2025',
        category: 'Financial Documents',
        relatedSection: 'revenueContext',
        description: 'Full audited P&L statement',
        documentReference: 'FIN-2025-AUDIT.pdf',
        status: 'Provided'
      });

      expect(res.status).toBe(201);
      expect(res.body.record).toBeDefined();
      expect(res.body.record.title).toBe('Audited Financials 2025');
      expect(res.body.record.status).toBe('Provided');
    });

    it('should reject evidence creation with 400 when title or status is invalid', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const pRes = await agent.post('/api/profiles').send({
        businessName: 'Evidence Co',
        description: 'Testing invalid'
      });
      const profileId = pRes.body.profile._id;

      // Missing title
      const noTitle = await agent.post('/api/evidence').send({
        profileId,
        category: 'Financial Documents',
        relatedSection: 'revenueContext',
        status: 'Provided'
      });
      expect(noTitle.status).toBe(400);

      // Invalid status
      const badStatus = await agent.post('/api/evidence').send({
        profileId,
        title: 'Title',
        category: 'Financial Documents',
        relatedSection: 'revenueContext',
        status: 'InvalidStatus'
      });
      expect(badStatus.status).toBe(400);
    });

    it('should return only records for the requested profile owned by the founder', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const pRes = await agent.post('/api/profiles').send({
        businessName: 'Multi Record Co',
        description: 'Multi records'
      });
      const profileId = pRes.body.profile._id;

      await agent.post('/api/evidence').send({
        profileId,
        title: 'Doc 1',
        category: 'Financial Documents',
        relatedSection: 'revenueContext',
        status: 'Provided'
      });
      await agent.post('/api/evidence').send({
        profileId,
        title: 'Doc 2',
        category: 'Legal and Compliance',
        relatedSection: 'businessModel',
        status: 'Awaiting Review'
      });

      const listRes = await agent.get('/api/evidence/' + profileId);
      expect(listRes.status).toBe(200);
      expect(listRes.body.records.length).toBe(2);
    });

    it('should update and delete an evidence record', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const pRes = await agent.post('/api/profiles').send({
        businessName: 'Update Delete Co',
        description: 'CRUD check'
      });
      const profileId = pRes.body.profile._id;

      const recRes = await agent.post('/api/evidence').send({
        profileId,
        title: 'Old Title',
        category: 'Market Research',
        relatedSection: 'targetCustomers',
        status: 'Missing'
      });
      const recordId = recRes.body.record._id;

      // Update
      const upRes = await agent.put('/api/evidence/' + recordId).send({
        title: 'New Title',
        status: 'Provided'
      });
      expect(upRes.status).toBe(200);
      expect(upRes.body.record.title).toBe('New Title');
      expect(upRes.body.record.status).toBe('Provided');

      // Delete
      const delRes = await agent.delete('/api/evidence/' + recordId);
      expect(delRes.status).toBe(200);

      const listRes = await agent.get('/api/evidence/' + profileId);
      expect(listRes.body.records.length).toBe(0);
    });
  });

  describe('Property-Based Tests for Evidence Records', () => {
    // Feature: venture-lens, Property 7: Ownership isolation for Evidence Records
    it('Property 7: Ownership isolation for Evidence Records (100 runs)', async () => {
      const f1 = await createAuthenticatedAgent({ role: 'Founder', email: 'ev_f1@test.com' });
      const f2 = await createAuthenticatedAgent({ role: 'Founder', email: 'ev_f2@test.com' });

      const p1Res = await f1.agent.post('/api/profiles').send({
        businessName: 'F1 Company',
        description: 'F1 Desc'
      });
      const profile1Id = p1Res.body.profile._id;

      const e1Res = await f1.agent.post('/api/evidence').send({
        profileId: profile1Id,
        title: 'F1 Secret Doc',
        category: 'Financial Documents',
        relatedSection: 'revenueContext',
        status: 'Provided'
      });
      const record1Id = e1Res.body.record._id;

      const updateGen = fc.record({
        title: fc.string({ minLength: 1, maxLength: 100 }),
        status: fc.constantFrom('Missing', 'Provided', 'Awaiting Review', 'Outdated')
      });

      await fc.assert(
        fc.asyncProperty(updateGen, async (payload) => {
          // Founder 2 tries to update Founder 1 record -> 403
          const putRes = await f2.agent.put('/api/evidence/' + record1Id).send(payload);
          expect(putRes.status).toBe(403);

          // Founder 2 tries to read Founder 1 profile evidence -> 403
          const getRes = await f2.agent.get('/api/evidence/' + profile1Id);
          expect(getRes.status).toBe(403);

          // Founder 2 tries to add record to Founder 1 profile -> 403
          const addRes = await f2.agent.post('/api/evidence').send({
            profileId: profile1Id,
            title: payload.title,
            category: 'Market Research',
            relatedSection: 'stage',
            status: payload.status
          });
          expect(addRes.status).toBe(403);

          // Founder 2 tries to delete Founder 1 record -> 403
          const delRes = await f2.agent.delete('/api/evidence/' + record1Id);
          expect(delRes.status).toBe(403);
        }),
        { numRuns: 100 }
      );
    });
  });
});
