'use strict';

const request = require('supertest');
const fc = require('fast-check');
const { setupTestDB, teardownTestDB, clearDatabase, getApp, createAuthenticatedAgent } = require('./test-helper');
const BusinessProfile = require('../server/models/BusinessProfile');

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

describe('Business Profile Routes & Isolation', () => {
  describe('Founder CRUD Operations', () => {
    it('should create a business profile successfully with 201', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const res = await agent.post('/api/profiles').send({
        businessName: 'Starlight Tech',
        description: 'AI-driven logistics automation',
        industry: 'Logistics',
        stage: 'Seed',
        fundingGoal: 750000
      });

      expect(res.status).toBe(201);
      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.businessName).toBe('Starlight Tech');
      expect(res.body.profile.fundingGoal).toBe(750000);
      expect(res.body.profile.publicationStatus).toBe('Unpublished');
    });

    it('should reject profile creation when businessName is missing or description is missing', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const noName = await agent.post('/api/profiles').send({ description: 'A test' });
      expect(noName.status).toBe(400);
      expect(noName.body.field).toBe('businessName');

      const noDesc = await agent.post('/api/profiles').send({ businessName: 'Acme' });
      expect(noDesc.status).toBe(400);
      expect(noDesc.body.field).toBe('description');
    });

    it('should get own profile via GET /api/profiles/mine', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      await agent.post('/api/profiles').send({
        businessName: 'Mine Startup',
        description: 'My cool startup'
      });

      const res = await agent.get('/api/profiles/mine');
      expect(res.status).toBe(200);
      expect(res.body.profile.businessName).toBe('Mine Startup');
    });

    it('should update own profile via PUT /api/profiles/:id', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const createRes = await agent.post('/api/profiles').send({
        businessName: 'Initial Name',
        description: 'Initial Description'
      });
      const profileId = createRes.body.profile._id;

      const updateRes = await agent.put('/api/profiles/' + profileId).send({
        businessName: 'Updated Name',
        stage: 'Series A',
        fundingGoal: 2000000
      });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.profile.businessName).toBe('Updated Name');
      expect(updateRes.body.profile.stage).toBe('Series A');
      expect(updateRes.body.profile.fundingGoal).toBe(2000000);
    });

    it('should delete own profile via DELETE /api/profiles/:id', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const createRes = await agent.post('/api/profiles').send({
        businessName: 'To Delete',
        description: 'Deleting soon'
      });
      const profileId = createRes.body.profile._id;

      const delRes = await agent.delete('/api/profiles/' + profileId);
      expect(delRes.status).toBe(200);

      const mineRes = await agent.get('/api/profiles/mine');
      expect(mineRes.body.profile).toBeNull();
    });
  });

  describe('Publication Status & Investor Discovery', () => {
    it('should toggle publication status Unpublished -> Published -> Unpublished', async () => {
      const { agent } = await createAuthenticatedAgent({ role: 'Founder' });
      const createRes = await agent.post('/api/profiles').send({
        businessName: 'Toggle Startup',
        description: 'Testing toggle'
      });
      const profileId = createRes.body.profile._id;

      // Toggle to Published
      const toggle1 = await agent.put('/api/profiles/' + profileId + '/toggle-publication');
      expect(toggle1.status).toBe(200);
      expect(toggle1.body.publicationStatus).toBe('Published');

      // Toggle back to Unpublished
      const toggle2 = await agent.put('/api/profiles/' + profileId + '/toggle-publication');
      expect(toggle2.status).toBe(200);
      expect(toggle2.body.publicationStatus).toBe('Unpublished');
    });

    it('should allow Investors to discover only Published profiles', async () => {
      const founder = await createAuthenticatedAgent({ role: 'Founder', email: 'f_pub@test.com' });
      const investor = await createAuthenticatedAgent({ role: 'Investor', email: 'inv_pub@test.com' });

      // Create 2 profiles: 1 unpublished, 1 published
      const p1Res = await founder.agent.post('/api/profiles').send({
        businessName: 'Unpublished Co',
        description: 'Private'
      });
      const p1Id = p1Res.body.profile._id;

      // Update p1 to published
      await founder.agent.put('/api/profiles/' + p1Id + '/toggle-publication');

      // Create second founder with unpublished profile
      const founder2 = await createAuthenticatedAgent({ role: 'Founder', email: 'f2_pub@test.com' });
      const p2Res = await founder2.agent.post('/api/profiles').send({
        businessName: 'Still Private Co',
        description: 'Not published yet'
      });
      const p2Id = p2Res.body.profile._id;

      // Investor list
      const listRes = await investor.agent.get('/api/profiles');
      expect(listRes.status).toBe(200);
      expect(listRes.body.profiles.length).toBe(1);
      expect(listRes.body.profiles[0].businessName).toBe('Unpublished Co');

      // Direct access to published
      const directPub = await investor.agent.get('/api/profiles/' + p1Id);
      expect(directPub.status).toBe(200);

      // Direct access to unpublished returns 403
      const directUnpub = await investor.agent.get('/api/profiles/' + p2Id);
      expect(directUnpub.status).toBe(403);
    });
  });

  describe('Property-Based Tests for Business Profiles', () => {
    // Feature: venture-lens, Property 5: Funding goal range is enforced universally
    it('Property 5: Funding goal range (<0.01 or >999999999.99) is rejected (100 runs)', async () => {
      const founder = await createAuthenticatedAgent({ role: 'Founder' });
      const createRes = await founder.agent.post('/api/profiles').send({
        businessName: 'Range Test Startup',
        description: 'Checking fundingGoal bounds'
      });
      const profileId = createRes.body.profile._id;

      const invalidGoalGen = fc.oneof(
        fc.double({ max: 0.009, noNaN: true }),
        fc.double({ min: 1000000000, noNaN: true })
      );

      await fc.assert(
        fc.asyncProperty(invalidGoalGen, async (invalidGoal) => {
          const res = await founder.agent.put('/api/profiles/' + profileId).send({
            fundingGoal: invalidGoal
          });
          expect(res.status).toBe(400);
          expect(res.body.field).toBe('fundingGoal');
        }),
        { numRuns: 100 }
      );
    });

    // Feature: venture-lens, Property 6: Ownership isolation for Business Profiles
    it('Property 6: Ownership isolation for Business Profiles (100 runs)', async () => {
      const f1 = await createAuthenticatedAgent({ role: 'Founder', email: 'owner1@test.com' });
      const f2 = await createAuthenticatedAgent({ role: 'Founder', email: 'owner2@test.com' });

      const p1Res = await f1.agent.post('/api/profiles').send({
        businessName: 'Owner 1 Startup',
        description: 'Original description'
      });
      const profile1Id = p1Res.body.profile._id;

      const updateGen = fc.record({
        businessName: fc.string({ minLength: 1, maxLength: 50 }),
        stage: fc.string({ minLength: 1, maxLength: 50 })
      });

      await fc.assert(
        fc.asyncProperty(updateGen, async (payload) => {
          // Founder 2 tries to update Founder 1 profile -> 403
          const putRes = await f2.agent.put('/api/profiles/' + profile1Id).send(payload);
          expect(putRes.status).toBe(403);

          // Founder 2 tries to toggle Founder 1 publication -> 403
          const toggleRes = await f2.agent.put('/api/profiles/' + profile1Id + '/toggle-publication');
          expect(toggleRes.status).toBe(403);

          // Founder 2 tries to delete Founder 1 profile -> 403
          const delRes = await f2.agent.delete('/api/profiles/' + profile1Id);
          expect(delRes.status).toBe(403);
        }),
        { numRuns: 100 }
      );
    });

    // Feature: venture-lens, Property 9: Publication toggle round-trip
    it('Property 9: Publication toggle round-trip (100 runs)', async () => {
      const founder = await createAuthenticatedAgent({ role: 'Founder' });
      const createRes = await founder.agent.post('/api/profiles').send({
        businessName: 'Roundtrip Startup',
        description: 'Testing round-trip'
      });
      const profileId = createRes.body.profile._id;

      for (let i = 0; i < 50; i++) {
        // First toggle: Unpublished -> Published
        const t1 = await founder.agent.put('/api/profiles/' + profileId + '/toggle-publication');
        expect(t1.status).toBe(200);
        expect(t1.body.publicationStatus).toBe('Published');

        // Second toggle: Published -> Unpublished
        const t2 = await founder.agent.put('/api/profiles/' + profileId + '/toggle-publication');
        expect(t2.status).toBe(200);
        expect(t2.body.publicationStatus).toBe('Unpublished');
      }
    });
  });
});
