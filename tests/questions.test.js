'use strict';

const request = require('supertest');
const fc = require('fast-check');
const { setupTestDB, teardownTestDB, clearDatabase, getApp, createAuthenticatedAgent } = require('./test-helper');
const BusinessProfile = require('../server/models/BusinessProfile');
const Question = require('../server/models/Question');

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

describe('Question Routes & Due Diligence Workflows', () => {
  describe('Investor Submit & Founder Response Workflows', () => {
    it('should allow Investor to submit question on Published profile and founder to respond', async () => {
      const founder = await createAuthenticatedAgent({ role: 'Founder', email: 'f_q@test.com' });
      const investor = await createAuthenticatedAgent({ role: 'Investor', email: 'inv_q@test.com' });

      // Founder creates and publishes profile
      const pRes = await founder.agent.post('/api/profiles').send({
        businessName: 'Quantum AI',
        description: 'Quantum hardware startup'
      });
      const profileId = pRes.body.profile._id;
      await founder.agent.put('/api/profiles/' + profileId + '/toggle-publication');

      // Investor submits question
      const qRes = await investor.agent.post('/api/questions').send({
        profileId,
        text: 'What is your current patent status?',
        sectionReference: 'solutionStatement'
      });
      expect(qRes.status).toBe(201);
      expect(qRes.body.question.status).toBe('Open');
      const questionId = qRes.body.question._id;

      // Founder views questions
      const fList = await founder.agent.get('/api/questions/profile/' + profileId);
      expect(fList.status).toBe(200);
      expect(fList.body.questions.length).toBe(1);

      // Founder responds to question
      const respRes = await founder.agent.post('/api/questions/' + questionId + '/respond').send({
        responseText: 'We have 3 provisional patents filed in the US and EU.'
      });
      expect(respRes.status).toBe(200);
      expect(respRes.body.question.status).toBe('Answered');
      expect(respRes.body.question.responseText).toBe('We have 3 provisional patents filed in the US and EU.');

      // Responding again returns 409
      const reResp = await founder.agent.post('/api/questions/' + questionId + '/respond').send({
        responseText: 'Another response'
      });
      expect(reResp.status).toBe(409);

      // Investor views in history
      const invList = await investor.agent.get('/api/questions/mine');
      expect(invList.status).toBe(200);
      expect(invList.body.questions[0].status).toBe('Answered');

      // Investor closes question
      const closeRes = await investor.agent.post('/api/questions/' + questionId + '/close');
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.question.status).toBe('Closed');
    });

    it('should reject question on unpublished profile with 403', async () => {
      const founder = await createAuthenticatedAgent({ role: 'Founder', email: 'f_unpub@test.com' });
      const investor = await createAuthenticatedAgent({ role: 'Investor', email: 'inv_unpub@test.com' });

      const pRes = await founder.agent.post('/api/profiles').send({
        businessName: 'Secret Stealth Co',
        description: 'Stealth startup'
      });
      const profileId = pRes.body.profile._id;

      const qRes = await investor.agent.post('/api/questions').send({
        profileId,
        text: 'Can I see more info?'
      });
      expect(qRes.status).toBe(403);
    });

    it('should allow Founder to close an open or answered question', async () => {
      const founder = await createAuthenticatedAgent({ role: 'Founder', email: 'f_close@test.com' });
      const investor = await createAuthenticatedAgent({ role: 'Investor', email: 'inv_close@test.com' });

      const pRes = await founder.agent.post('/api/profiles').send({
        businessName: 'Close Test Co',
        description: 'Testing close'
      });
      const profileId = pRes.body.profile._id;
      await founder.agent.put('/api/profiles/' + profileId + '/toggle-publication');

      const qRes = await investor.agent.post('/api/questions').send({
        profileId,
        text: 'Founder will close this directly'
      });
      const questionId = qRes.body.question._id;

      const closeRes = await founder.agent.post('/api/questions/' + questionId + '/close');
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.question.status).toBe('Closed');
    });
  });

  describe('Property-Based Tests for Questions', () => {
    // Feature: venture-lens, Property 8: Question visibility isolation
    it('Property 8: Question visibility isolation between multiple investors (50 runs)', async () => {
      const founder = await createAuthenticatedAgent({ role: 'Founder', email: 'f_iso@test.com' });
      const pRes = await founder.agent.post('/api/profiles').send({
        businessName: 'Iso Startup',
        description: 'Iso Description'
      });
      const profileId = pRes.body.profile._id;
      await founder.agent.put('/api/profiles/' + profileId + '/toggle-publication');

      const inv1 = await createAuthenticatedAgent({ role: 'Investor', email: 'inv_iso1@test.com' });
      const inv2 = await createAuthenticatedAgent({ role: 'Investor', email: 'inv_iso2@test.com' });

      for (let i = 0; i < 5; i++) {
        await inv1.agent.post('/api/questions').send({
          profileId,
          text: 'Investor 1 Question ' + i
        });
        await inv2.agent.post('/api/questions').send({
          profileId,
          text: 'Investor 2 Question ' + i
        });
      }

      const q1Res = await inv1.agent.get('/api/questions/mine');
      expect(q1Res.body.questions.length).toBe(5);
      q1Res.body.questions.forEach(q => {
        expect(q.text).toContain('Investor 1');
        expect(q.text).not.toContain('Investor 2');
      });

      const q2Res = await inv2.agent.get('/api/questions/mine');
      expect(q2Res.body.questions.length).toBe(5);
      q2Res.body.questions.forEach(q => {
        expect(q.text).toContain('Investor 2');
        expect(q.text).not.toContain('Investor 1');
      });
    });

    // Feature: venture-lens, Property 10: Questions cannot be submitted to unpublished profiles
    it('Property 10: Questions cannot be submitted to unpublished profiles (100 runs)', async () => {
      const founder = await createAuthenticatedAgent({ role: 'Founder', email: 'f_p10@test.com' });
      const investor = await createAuthenticatedAgent({ role: 'Investor', email: 'inv_p10@test.com' });

      const pRes = await founder.agent.post('/api/profiles').send({
        businessName: 'Unpublished Only Co',
        description: 'Always unpublished'
      });
      const profileId = pRes.body.profile._id;

      const questionGen = fc.record({
        text: fc.string({ minLength: 1, maxLength: 500 }),
        sectionReference: fc.string({ maxLength: 50 })
      });

      await fc.assert(
        fc.asyncProperty(questionGen, async (qPayload) => {
          const res = await investor.agent.post('/api/questions').send({
            profileId,
            text: qPayload.text,
            sectionReference: qPayload.sectionReference
          });
          expect(res.status).toBe(403);

          // Verify no question is created
          const count = await Question.countDocuments({ profile: profileId });
          expect(count).toBe(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
