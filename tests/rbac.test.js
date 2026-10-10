'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const { setupTestDB, teardownTestDB, clearDatabase, getApp, createAuthenticatedAgent } = require('./test-helper');
const BusinessProfile = require('../server/models/BusinessProfile');
const EvidenceRecord = require('../server/models/EvidenceRecord');
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

describe('Role-Based Access Control (RBAC) & Route Guarding', () => {
  let founderAgent;
  let investorAgent;
  let testProfileId;
  let testEvidenceId;
  let testQuestionId;

  beforeEach(async () => {
    // Setup authenticated agents
    founderAgent = (await createAuthenticatedAgent({ role: 'Founder', email: 'rbac_f@test.com' })).agent;
    investorAgent = (await createAuthenticatedAgent({ role: 'Investor', email: 'rbac_i@test.com' })).agent;

    // Create fixture data
    const pRes = await founderAgent.post('/api/profiles').send({
      businessName: 'RBAC Test Startup',
      description: 'Role based access testing'
    });
    testProfileId = pRes.body.profile._id;

    const eRes = await founderAgent.post('/api/evidence').send({
      profileId: testProfileId,
      title: 'RBAC Doc',
      category: 'Legal and Compliance',
      relatedSection: 'problemStatement',
      status: 'Provided'
    });
    testEvidenceId = eRes.body.record._id;

    await founderAgent.put('/api/profiles/' + testProfileId + '/toggle-publication');

    const qRes = await investorAgent.post('/api/questions').send({
      profileId: testProfileId,
      text: 'RBAC question?'
    });
    testQuestionId = qRes.body.question._id;
  });

  describe('Unauthenticated Access (401)', () => {
    it('should return 401 for all protected endpoints when no session is provided', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const endpoints = [
        { method: 'get', path: '/api/auth/me' },
        { method: 'post', path: '/api/auth/logout' },
        { method: 'get', path: '/api/profiles/mine' },
        { method: 'post', path: '/api/profiles' },
        { method: 'put', path: '/api/profiles/' + fakeId },
        { method: 'delete', path: '/api/profiles/' + fakeId },
        { method: 'put', path: '/api/profiles/' + fakeId + '/toggle-publication' },
        { method: 'get', path: '/api/profiles' },
        { method: 'get', path: '/api/profiles/' + fakeId },
        { method: 'get', path: '/api/readiness/' + fakeId },
        { method: 'post', path: '/api/evidence' },
        { method: 'get', path: '/api/evidence/' + fakeId },
        { method: 'put', path: '/api/evidence/' + fakeId },
        { method: 'delete', path: '/api/evidence/' + fakeId },
        { method: 'post', path: '/api/questions' },
        { method: 'get', path: '/api/questions/mine' },
        { method: 'get', path: '/api/questions/profile/' + fakeId },
        { method: 'post', path: '/api/questions/' + fakeId + '/respond' },
        { method: 'post', path: '/api/questions/' + fakeId + '/close' }
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path);
        expect(res.status).toBe(401);
      }
    });
  });

  describe('Founder-Only Endpoints Accessed by Investor (403)', () => {
    it('should return 403 when Investor accesses Founder-only endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/profiles/mine' },
        { method: 'post', path: '/api/profiles', body: { businessName: 'Test', description: 'Test' } },
        { method: 'put', path: '/api/profiles/' + testProfileId, body: { businessName: 'Hacked' } },
        { method: 'delete', path: '/api/profiles/' + testProfileId },
        { method: 'put', path: '/api/profiles/' + testProfileId + '/toggle-publication' },
        { method: 'get', path: '/api/readiness/' + testProfileId },
        { method: 'post', path: '/api/evidence', body: { profileId: testProfileId, title: 'Hacked', category: 'Legal', relatedSection: 'sec', status: 'Provided' } },
        { method: 'get', path: '/api/evidence/' + testProfileId },
        { method: 'put', path: '/api/evidence/' + testEvidenceId, body: { title: 'Hacked' } },
        { method: 'delete', path: '/api/evidence/' + testEvidenceId },
        { method: 'get', path: '/api/questions/profile/' + testProfileId },
        { method: 'post', path: '/api/questions/' + testQuestionId + '/respond', body: { responseText: 'Hacked' } }
      ];

      for (const ep of endpoints) {
        const req = investorAgent[ep.method](ep.path);
        if (ep.body) req.send(ep.body);
        const res = await req;
        expect(res.status).toBe(403);
      }
    });
  });

  describe('Investor-Only Endpoints Accessed by Founder (403)', () => {
    it('should return 403 when Founder accesses Investor-only endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/profiles' },
        { method: 'get', path: '/api/profiles/' + testProfileId },
        { method: 'post', path: '/api/questions', body: { profileId: testProfileId, text: 'Founder asking self?' } },
        { method: 'get', path: '/api/questions/mine' }
      ];

      for (const ep of endpoints) {
        const req = founderAgent[ep.method](ep.path);
        if (ep.body) req.send(ep.body);
        const res = await req;
        expect(res.status).toBe(403);
      }
    });
  });
});
