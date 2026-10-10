'use strict';
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}
const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { connectDB } = require('./db');
const authRouter = require('./routes/auth');
const profilesRouter = require('./routes/profiles');
const readinessRouter = require('./routes/readiness');
const evidenceRouter = require('./routes/evidence');
const questionsRouter = require('./routes/questions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const isTest = process.env.NODE_ENV === 'test';
const sessionStore = isTest
  ? new session.MemoryStore()
  : MongoStore.create({ mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/venturelens', ttl: 24 * 60 * 60 });

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/readiness', readinessRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/questions', questionsRouter);

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log('VentureLens server running on http://localhost:' + PORT);
    });
  });
}

module.exports = app;
