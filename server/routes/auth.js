'use strict';
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) return res.status(400).json({ error: 'Name is required', field: 'name' });
    if (name.trim().length > 100) return res.status(400).json({ error: 'Name must be 100 characters or fewer', field: 'name' });
    if (!email || typeof email !== 'string' || email.trim().length === 0) return res.status(400).json({ error: 'Email is required', field: 'email' });
    if (!EMAIL_REGEX.test(email.trim())) return res.status(400).json({ error: 'Email address is not valid', field: 'email' });
    if (!password || typeof password !== 'string' || password.length === 0) return res.status(400).json({ error: 'Password is required', field: 'password' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters', field: 'password' });
    if (password.length > 128) return res.status(400).json({ error: 'Password must be 128 characters or fewer', field: 'password' });
    if (!role || !['Founder', 'Investor'].includes(role)) return res.status(400).json({ error: 'Role must be Founder or Investor', field: 'role' });
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists', field: 'email' });
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash, role });
    await new Promise((resolve, reject) => { req.session.regenerate((err) => { if (err) return reject(err); req.session.userId = user._id.toString(); req.session.role = user.role; req.session.name = user.name; resolve(); }); });
    return res.status(201).json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string' || email.trim().length === 0) return res.status(400).json({ error: 'Email is required', field: 'email' });
    if (!EMAIL_REGEX.test(email.trim())) return res.status(400).json({ error: 'Email address is not valid', field: 'email' });
    if (!password || typeof password !== 'string' || password.length === 0) return res.status(400).json({ error: 'Password is required', field: 'password' });
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.lockUntil && user.lockUntil > new Date()) return res.status(423).json({ error: 'Account temporarily locked. Please try again later.' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) { user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS); }
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    user.loginAttempts = 0; user.lockUntil = null; await user.save();
    await new Promise((resolve, reject) => { req.session.regenerate((err) => { if (err) return reject(err); req.session.userId = user._id.toString(); req.session.role = user.role; req.session.name = user.name; resolve(); }); });
    return res.status(200).json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});
router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    return res.status(200).json({ message: 'Logged out' });
  });
});
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId).select('-passwordHash -loginAttempts -lockUntil');
    if (!user) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Session invalid' }); }
    return res.status(200).json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});
module.exports = router;