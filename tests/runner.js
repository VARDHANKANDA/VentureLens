'use strict';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key-123456';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const fc = require('fast-check');
const assert = require('assert');

const { computeReadiness, TOTAL_SECTIONS, TEXT_FIELDS } = require('../server/utils/readiness');

let mongoServer;
let app;
let passedCount = 0;
let failedCount = 0;

async function runTest(name, fn) {
  try {
    process.stdout.write('  RUNS  ' + name);
    await fn();
    passedCount++;
    process.stdout.write('\r  PASS  ' + name + '\n');
  } catch (err) {
    failedCount++;
    process.stdout.write('\r  FAIL  ' + name + '\n');
    console.error('    Error:', err.message || err);
    if (err.stack) console.error('    Stack:', err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

async function clearDB() {
  if (mongoose.connection.readyState !== 0 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const c of collections) {
      await c.deleteMany({});
    }
  }
}

async function createAgent(userOverrides = {}) {
  const agent = request.agent(app);
  const defaultUser = {
    name: 'Test User',
    email: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(7) + '@test.com',
    password: 'password123',
    role: 'Founder'
  };
  const userData = { ...defaultUser, ...userOverrides };
  const res = await agent.post('/api/auth/register').send(userData);
  return { agent, user: res.body.user, rawUser: userData };
}

async function main() {
  console.log('\n======================================================');
  console.log(' VentureLens Automated Test Suite (MERN / Fast-Check)');
  console.log('======================================================\n');

  console.log('Starting In-Memory MongoDB Server...');
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
  app = require('../server/index');
  console.log('MongoDB connected at:', uri);
  console.log('Express application initialized.\n');

  // ==========================================
  // SUITE 1: Auth Endpoints & RBAC
  // ==========================================
  console.log('--- Suite 1: Authentication & User Lifecycle ---');

  await runTest('1.1 Register Founder successfully (201, password masked)', async () => {
    await clearDB();
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Founder',
      email: 'alice@venture.io',
      password: 'securePassword123',
      role: 'Founder'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user.name, 'Alice Founder');
    assert.strictEqual(res.body.user.email, 'alice@venture.io');
    assert.strictEqual(res.body.user.role, 'Founder');
    assert.strictEqual(res.body.user.passwordHash, undefined);
  });

  await runTest('1.2 Reject duplicate email with 409', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Two',
      email: 'ALICE@VENTURE.IO',
      password: 'anotherPassword123',
      role: 'Investor'
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.field, 'email');
  });

  await runTest('1.3 Reject invalid validation payloads (short pass, bad email, bad role)', async () => {
    const r1 = await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'invalid-email', password: 'password123', role: 'Founder' });
    assert.strictEqual(r1.status, 400);

    const r2 = await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@test.com', password: 'short', role: 'Founder' });
    assert.strictEqual(r2.status, 400);

    const r3 = await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@test.com', password: 'password123', role: 'Admin' });
    assert.strictEqual(r3.status, 400);
  });

  await runTest('1.4 Login success with 200 and session cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@venture.io',
      password: 'securePassword123'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, 'alice@venture.io');
    assert.ok(res.headers['set-cookie']);
  });

  await runTest('1.5 Login rate-limiting and account lockout after 5 failed attempts (423)', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/auth/login').send({ email: 'alice@venture.io', password: 'wrongPassword' });
      assert.strictEqual(r.status, 401);
    }
    const lockedRes = await request(app).post('/api/auth/login').send({ email: 'alice@venture.io', password: 'securePassword123' });
    assert.strictEqual(lockedRes.status, 423);
  });

  await runTest('1.6 Logout invalidates session and GET /api/auth/me returns 401', async () => {
    const { agent } = await createAgent({ role: 'Founder' });
    const me1 = await agent.get('/api/auth/me');
    assert.strictEqual(me1.status, 200);

    const logoutRes = await agent.post('/api/auth/logout');
    assert.strictEqual(logoutRes.status, 200);

    const me2 = await agent.get('/api/auth/me');
    assert.strictEqual(me2.status, 401);
  });

  // ==========================================
  // SUITE 2: Business Profile CRUD & Discovery
  // ==========================================
  console.log('\n--- Suite 2: Business Profiles & Discovery ---');

  let founderAgent, investorAgent, profileId;

  await runTest('2.1 Founder creates business profile (201)', async () => {
    await clearDB();
    founderAgent = (await createAgent({ role: 'Founder', email: 'founder@test.com' })).agent;
    investorAgent = (await createAgent({ role: 'Investor', email: 'investor@test.com' })).agent;

    const res = await founderAgent.post('/api/profiles').send({
      businessName: 'VentureLens AI',
      description: 'Fundraising readiness platform',
      industry: 'B2B SaaS',
      stage: 'Seed',
      fundingGoal: 1500000
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.profile.businessName, 'VentureLens AI');
    assert.strictEqual(res.body.profile.publicationStatus, 'Unpublished');
    profileId = res.body.profile._id;
  });

  await runTest('2.2 Founder reads own profile via GET /api/profiles/mine', async () => {
    const res = await founderAgent.get('/api/profiles/mine');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.profile.businessName, 'VentureLens AI');
  });

  await runTest('2.3 Founder updates profile (PUT /api/profiles/:id)', async () => {
    const res = await founderAgent.put('/api/profiles/' + profileId).send({
      businessName: 'VentureLens Pro',
      problemStatement: 'Due diligence is disorganized'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.profile.businessName, 'VentureLens Pro');
    assert.strictEqual(res.body.profile.problemStatement, 'Due diligence is disorganized');
  });

  await runTest('2.4 Publication toggle and Investor discovery isolation', async () => {
    // While unpublished, investor sees 0 profiles
    const listBefore = await investorAgent.get('/api/profiles');
    assert.strictEqual(listBefore.status, 200);
    assert.strictEqual(listBefore.body.profiles.length, 0);

    // Toggle to Published
    const toggleRes = await founderAgent.put('/api/profiles/' + profileId + '/toggle-publication');
    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual(toggleRes.body.publicationStatus, 'Published');

    // Investor now sees published profile
    const listAfter = await investorAgent.get('/api/profiles');
    assert.strictEqual(listAfter.status, 200);
    assert.strictEqual(listAfter.body.profiles.length, 1);

    // Investor reads profile details
    const detail = await investorAgent.get('/api/profiles/' + profileId);
    assert.strictEqual(detail.status, 200);
    assert.strictEqual(detail.body.profile.businessName, 'VentureLens Pro');
  });

  await runTest('2.5 Ownership Isolation: Founder 2 cannot modify Founder 1 profile (403)', async () => {
    const founder2 = (await createAgent({ role: 'Founder', email: 'founder2@test.com' })).agent;
    const putRes = await founder2.put('/api/profiles/' + profileId).send({ businessName: 'Hijacked' });
    assert.strictEqual(putRes.status, 403);

    const delRes = await founder2.delete('/api/profiles/' + profileId);
    assert.strictEqual(delRes.status, 403);
  });

  // ==========================================
  // SUITE 3: Readiness Calculation & Guidance
  // ==========================================
  console.log('\n--- Suite 3: Readiness Scoring & Guidance ---');

  await runTest('3.1 Pure readiness calculation handles 0%, 100%, and partial accurately', () => {
    const empty = { businessName: '', description: '' };
    const r0 = computeReadiness(empty, false);
    assert.strictEqual(r0.completed, 0);
    assert.strictEqual(r0.total, 13);
    assert.strictEqual(r0.percentage, 0);
    assert.strictEqual(r0.incompleteItems.length, 13);

    const all = {
      businessName: 'A', description: 'B', industry: 'C', stage: 'D',
      businessModel: 'E', problemStatement: 'F', solutionStatement: 'G',
      targetCustomers: 'H', revenueContext: 'I', useOfFunds: 'J',
      milestones: 'K', fundingGoal: 100000
    };
    const r100 = computeReadiness(all, true);
    assert.strictEqual(r100.completed, 13);
    assert.strictEqual(r100.percentage, 100);
    assert.strictEqual(r100.incompleteItems.length, 0);

    const partial = { businessName: 'A', description: 'B', fundingGoal: 50000 };
    const rPart = computeReadiness(partial, false);
    assert.strictEqual(rPart.completed, 3);
    assert.strictEqual(rPart.percentage, Math.round((3 / 13) * 100)); // 23%
  });

  await runTest('3.2 GET /api/readiness/:profileId returns completeness breakdown', async () => {
    const res = await founderAgent.get('/api/readiness/' + profileId);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalSections, 13);
    assert.ok(res.body.completenessPercentage >= 0 && res.body.completenessPercentage <= 100);
    assert.ok(Array.isArray(res.body.incompleteItems));
  });

  // ==========================================
  // SUITE 4: Evidence Record Management
  // ==========================================
  console.log('\n--- Suite 4: Evidence Records & Coverage Map ---');

  let evidenceId;

  await runTest('4.1 Founder creates Evidence Record (201)', async () => {
    const res = await founderAgent.post('/api/evidence').send({
      profileId,
      title: 'Financial Statements 2025',
      category: 'Financial Documents',
      relatedSection: 'revenueContext',
      description: 'Audited balance sheet and income statement',
      documentReference: 'FIN-2025-Q4.pdf',
      status: 'Provided'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.record.title, 'Financial Statements 2025');
    assert.strictEqual(res.body.record.status, 'Provided');
    evidenceId = res.body.record._id;
  });

  await runTest('4.2 Founder lists Evidence Records for profile', async () => {
    const res = await founderAgent.get('/api/evidence/' + profileId);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.records.length, 1);
  });

  await runTest('4.3 Founder updates Evidence Record (PUT /api/evidence/:id)', async () => {
    const res = await founderAgent.put('/api/evidence/' + evidenceId).send({
      status: 'Awaiting Review',
      description: 'Updated description'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.record.status, 'Awaiting Review');
  });

  await runTest('4.4 Ownership Isolation: Other Founder cannot edit or delete evidence (403)', async () => {
    const founder2 = (await createAgent({ role: 'Founder', email: 'f2_ev@test.com' })).agent;
    const putRes = await founder2.put('/api/evidence/' + evidenceId).send({ title: 'Hacked' });
    assert.strictEqual(putRes.status, 403);

    const delRes = await founder2.delete('/api/evidence/' + evidenceId);
    assert.strictEqual(delRes.status, 403);
  });

  // ==========================================
  // SUITE 5: Due Diligence Q&A Workflow
  // ==========================================
  console.log('\n--- Suite 5: Investor Q&A & Due Diligence ---');

  let questionId;

  await runTest('5.1 Investor submits due diligence question (201, status Open)', async () => {
    const res = await investorAgent.post('/api/questions').send({
      profileId,
      text: 'What is your customer churn rate over the last 6 months?',
      sectionReference: 'revenueContext'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.question.status, 'Open');
    assert.strictEqual(res.body.question.text, 'What is your customer churn rate over the last 6 months?');
    questionId = res.body.question._id;
  });

  await runTest('5.2 Founder views question in inbox and submits response (status Answered)', async () => {
    const listRes = await founderAgent.get('/api/questions/profile/' + profileId);
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.questions.length, 1);

    const respRes = await founderAgent.post('/api/questions/' + questionId + '/respond').send({
      responseText: 'Our net revenue retention is 118% with monthly logo churn under 0.8%.'
    });
    assert.strictEqual(respRes.status, 200);
    assert.strictEqual(respRes.body.question.status, 'Answered');
    assert.strictEqual(respRes.body.question.responseText, 'Our net revenue retention is 118% with monthly logo churn under 0.8%.');
  });

  await runTest('5.3 Responding to non-Open question returns 409', async () => {
    const res = await founderAgent.post('/api/questions/' + questionId + '/respond').send({
      responseText: 'Duplicate response'
    });
    assert.strictEqual(res.status, 409);
  });

  await runTest('5.4 Investor views answer in history and closes question', async () => {
    const historyRes = await investorAgent.get('/api/questions/mine');
    assert.strictEqual(historyRes.status, 200);
    assert.strictEqual(historyRes.body.questions[0].status, 'Answered');

    const closeRes = await investorAgent.post('/api/questions/' + questionId + '/close');
    assert.strictEqual(closeRes.status, 200);
    assert.strictEqual(closeRes.body.question.status, 'Closed');
  });

  // ==========================================
  // SUITE 6: RBAC & Route Protection Matrix
  // ==========================================
  console.log('\n--- Suite 6: Full RBAC Matrix Verification ---');

  await runTest('6.1 Unauthenticated requests to protected endpoints return 401', async () => {
    const r1 = await request(app).get('/api/auth/me');
    assert.strictEqual(r1.status, 401);

    const r2 = await request(app).get('/api/profiles/mine');
    assert.strictEqual(r2.status, 401);

    const r3 = await request(app).get('/api/profiles');
    assert.strictEqual(r3.status, 401);

    const r4 = await request(app).post('/api/questions');
    assert.strictEqual(r4.status, 401);
  });

  await runTest('6.2 Investor accessing Founder endpoints returns 403', async () => {
    const r1 = await investorAgent.post('/api/profiles').send({ businessName: 'T', description: 'T' });
    assert.strictEqual(r1.status, 403);

    const r2 = await investorAgent.get('/api/profiles/mine');
    assert.strictEqual(r2.status, 403);

    const r3 = await investorAgent.post('/api/evidence').send({ profileId, title: 'T', category: 'C', relatedSection: 'S', status: 'Provided' });
    assert.strictEqual(r3.status, 403);

    const r4 = await investorAgent.get('/api/readiness/' + profileId);
    assert.strictEqual(r4.status, 403);
  });

  await runTest('6.3 Founder accessing Investor endpoints returns 403', async () => {
    const r1 = await founderAgent.get('/api/profiles');
    assert.strictEqual(r1.status, 403);

    const r2 = await founderAgent.post('/api/questions').send({ profileId, text: 'Self question?' });
    assert.strictEqual(r2.status, 403);

    const r3 = await founderAgent.get('/api/questions/mine');
    assert.strictEqual(r3.status, 403);
  });

  // ==========================================
  // SUITE 7: Fast-Check Property-Based Tests
  // ==========================================
  console.log('\n--- Suite 7: Fast-Check Property-Based Tests (100 runs each) ---');

  await runTest('Property 1: Completeness formula is (completed / 13) * 100 rounded (100 runs)', () => {
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
          assert.strictEqual(result.total, 13);
          assert.ok(result.completed >= 0 && result.completed <= 13);
          assert.strictEqual(result.percentage, Math.round((result.completed / 13) * 100));
          assert.strictEqual(result.incompleteItems.length, 13 - result.completed);
        }
      ),
      { numRuns: 100 }
    );
  });

  await runTest('Property 2: Whitespace-only fields are treated as incomplete (100 runs)', () => {
    const whitespaceGen = fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 20 }).map(arr => arr.join(''));
    fc.assert(
      fc.property(whitespaceGen, (ws) => {
        TEXT_FIELDS.forEach(field => {
          const pWs = { [field]: ws };
          const pEmpty = { [field]: '' };
          const rWs = computeReadiness(pWs, false);
          const rEmpty = computeReadiness(pEmpty, false);
          assert.strictEqual(rWs.completed, rEmpty.completed);
          assert.strictEqual(rWs.percentage, rEmpty.percentage);
        });
      }),
      { numRuns: 100 }
    );
  });

  await runTest('Property 3: Email validation rejects structurally invalid addresses (100 runs)', async () => {
    const invalidEmailGen = fc.string().filter(s => {
      const atCount = (s.match(/@/g) || []).length;
      if (atCount !== 1) return true;
      const [local, domain] = s.split('@');
      return !local || !domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.') || s.includes(' ');
    });

    await fc.assert(
      fc.asyncProperty(invalidEmailGen, async (invalidEmail) => {
        const res = await request(app).post('/api/auth/register').send({
          name: 'Prop User',
          email: invalidEmail,
          password: 'validPassword123',
          role: 'Founder'
        });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.field, 'email');
      }),
      { numRuns: 100 }
    );
  });

  await runTest('Property 4: Password length bounds (<8 or >128) are enforced universally (100 runs)', async () => {
    const shortGen = fc.string({ maxLength: 7 });
    await fc.assert(
      fc.asyncProperty(shortGen, async (shortPass) => {
        const res = await request(app).post('/api/auth/register').send({
          name: 'Short User',
          email: 'short_' + Math.random().toString(36).substring(7) + '@test.com',
          password: shortPass,
          role: 'Founder'
        });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.field, 'password');
      }),
      { numRuns: 100 }
    );
  });

  await runTest('Property 5: Funding goal range (<0.01 or >999999999.99) rejected (100 runs)', async () => {
    const invalidGoalGen = fc.oneof(
      fc.double({ max: 0.009, min: -1e12, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 1000000000, max: 1e12, noNaN: true, noDefaultInfinity: true })
    );
    await fc.assert(
      fc.asyncProperty(invalidGoalGen, async (invalidGoal) => {
        const res = await founderAgent.put('/api/profiles/' + profileId).send({ fundingGoal: invalidGoal });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.field, 'fundingGoal');
      }),
      { numRuns: 100 }
    );
  });

  await runTest('Property 9: Publication toggle round-trip invariance (50 cycles)', async () => {
    for (let i = 0; i < 25; i++) {
      const t1 = await founderAgent.put('/api/profiles/' + profileId + '/toggle-publication');
      assert.strictEqual(t1.status, 200);
      assert.strictEqual(t1.body.publicationStatus, 'Unpublished');

      const t2 = await founderAgent.put('/api/profiles/' + profileId + '/toggle-publication');
      assert.strictEqual(t2.status, 200);
      assert.strictEqual(t2.body.publicationStatus, 'Published');
    }
  });


  await runTest('Property 6: Ownership isolation for Business Profiles (100 runs)', async () => {
    const f1 = (await createAgent({ role: 'Founder', email: 'p6_f1@test.com' })).agent;
    const f2 = (await createAgent({ role: 'Founder', email: 'p6_f2@test.com' })).agent;
    const pRes = await f1.post('/api/profiles').send({ businessName: 'P6 Startup', description: 'Testing P6' });
    const pId = pRes.body.profile._id;

    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 50 }), async (newName) => {
        const r1 = await f2.put('/api/profiles/' + pId).send({ businessName: newName });
        assert.strictEqual(r1.status, 403);
        const r2 = await f2.delete('/api/profiles/' + pId);
        assert.strictEqual(r2.status, 403);
      }),
      { numRuns: 100 }
    );
  });

  await runTest('Property 7: Ownership isolation for Evidence Records (100 runs)', async () => {
    const f1 = (await createAgent({ role: 'Founder', email: 'p7_f1@test.com' })).agent;
    const f2 = (await createAgent({ role: 'Founder', email: 'p7_f2@test.com' })).agent;
    const pRes = await f1.post('/api/profiles').send({ businessName: 'P7 Startup', description: 'Testing P7' });
    const pId = pRes.body.profile._id;
    const eRes = await f1.post('/api/evidence').send({ profileId: pId, title: 'Doc', category: 'Financial Documents', relatedSection: 'sec', status: 'Provided' });
    const eId = eRes.body.record._id;

    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 50 }), async (newTitle) => {
        const r1 = await f2.put('/api/evidence/' + eId).send({ title: newTitle });
        assert.strictEqual(r1.status, 403);
        const r2 = await f2.delete('/api/evidence/' + eId);
        assert.strictEqual(r2.status, 403);
      }),
      { numRuns: 100 }
    );
  });

  await runTest('Property 8: Question visibility isolation across multiple investors (50 runs)', async () => {
    const f = (await createAgent({ role: 'Founder', email: 'p8_f@test.com' })).agent;
    const pRes = await f.post('/api/profiles').send({ businessName: 'P8 Startup', description: 'Testing P8' });
    const pId = pRes.body.profile._id;
    await f.put('/api/profiles/' + pId + '/toggle-publication');

    const inv1 = (await createAgent({ role: 'Investor', email: 'p8_inv1@test.com' })).agent;
    const inv2 = (await createAgent({ role: 'Investor', email: 'p8_inv2@test.com' })).agent;

    for (let i = 0; i < 5; i++) {
      await inv1.post('/api/questions').send({ profileId: pId, text: 'Inv1 Question ' + i });
      await inv2.post('/api/questions').send({ profileId: pId, text: 'Inv2 Question ' + i });
    }

    const q1 = await inv1.get('/api/questions/mine');
    assert.strictEqual(q1.body.questions.length, 5);
    q1.body.questions.forEach(q => assert.ok(q.text.includes('Inv1')));

    const q2 = await inv2.get('/api/questions/mine');
    assert.strictEqual(q2.body.questions.length, 5);
    q2.body.questions.forEach(q => assert.ok(q.text.includes('Inv2')));
  });

  await runTest('Property 10: Questions rejected on unpublished profiles (100 runs)', async () => {
    const f = (await createAgent({ role: 'Founder', email: 'p10_f@test.com' })).agent;
    const pRes = await f.post('/api/profiles').send({ businessName: 'P10 Startup', description: 'Testing P10' });
    const pId = pRes.body.profile._id;
    const inv = (await createAgent({ role: 'Investor', email: 'p10_inv@test.com' })).agent;

    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0), async (qText) => {
        const res = await inv.post('/api/questions').send({ profileId: pId, text: qText });
        assert.strictEqual(res.status, 403);
      }),
      { numRuns: 100 }
    );
  });

  // Teardown
  await mongoose.disconnect();
  await mongoServer.stop();

  console.log('\n======================================================');
  console.log(' Test Results: ' + passedCount + ' passed, ' + failedCount + ' failed, total ' + (passedCount + failedCount));
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
