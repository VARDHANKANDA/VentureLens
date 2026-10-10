'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

let mongoServer = null;
let app = null;

async function setupTestDB() {
  console.log('[DEBUG] 1. entering setupTestDB');
  mongoServer = await MongoMemoryServer.create();
  console.log('[DEBUG] 2. MMS created:', mongoServer.getUri());
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-secret-key-123456';
  
  if (mongoose.connection.readyState !== 0) {
    console.log('[DEBUG] 3. disconnecting existing mongoose');
    await mongoose.disconnect();
  }
  console.log('[DEBUG] 4. connecting mongoose to:', uri);
  await mongoose.connect(uri, { directConnection: true });
  console.log('[DEBUG] 5. mongoose connected!');
  
  app = require('../server/index');
  console.log('[DEBUG] 6. app required!');
  return { mongoServer, app, uri };
}

async function teardownTestDB() {
  console.log('[DEBUG] teardownTestDB starting');
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
  console.log('[DEBUG] teardownTestDB finished');
}

async function clearDatabase() {
  if (mongoose.connection.readyState !== 0 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
}

function getApp() {
  if (!app) {
    app = require('../server/index');
  }
  return app;
}

async function createAuthenticatedAgent(userOverrides = {}) {
  const currentApp = getApp();
  const agent = request.agent(currentApp);
  const defaultUser = {
    name: 'Test User',
    email: 'test' + Date.now() + Math.random().toString(36).substring(7) + '@example.com',
    password: 'password123',
    role: 'Founder'
  };
  const userData = { ...defaultUser, ...userOverrides };
  const res = await agent.post('/api/auth/register').send(userData);
  return { agent, user: res.body.user, rawUser: userData };
}

module.exports = {
  setupTestDB,
  teardownTestDB,
  clearDatabase,
  getApp,
  createAuthenticatedAgent
};
