'use strict';
const express = require('express');
const Question = require('../models/Question');
const BusinessProfile = require('../models/BusinessProfile');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const router = express.Router();
router.post('/', requireAuth, requireRole('Investor'), async (req, res, next) => {
  try {
    const { profileId, text, sectionReference } = req.body;
    if (!profileId) return res.status(400).json({ error: 'profileId is required', field: 'profileId' });
    if (!text || typeof text !== 'string' || text.trim().length === 0) return res.status(400).json({ error: 'Question text is required', field: 'text' });
    if (text.trim().length > 1000) return res.status(400).json({ error: 'Question text must be 1000 characters or fewer', field: 'text' });
    if (sectionReference && sectionReference.length > 100) return res.status(400).json({ error: 'Section reference must be 100 characters or fewer', field: 'sectionReference' });
    const profile = await BusinessProfile.findById(profileId);
    if (!profile) return res.status(404).json({ error: 'Business profile not found' });
    if (profile.publicationStatus !== 'Published') return res.status(403).json({ error: 'This business profile is not available for questions' });
    const question = await Question.create({ profile: profileId, investor: req.session.userId, text: text.trim(), sectionReference: (sectionReference||'').trim(), status: 'Open' });
    return res.status(201).json({ question });
  } catch (err) { next(err); }
});
router.get('/mine', requireAuth, requireRole('Investor'), async (req, res, next) => {
  try {
    const questions = await Question.find({ investor: req.session.userId }).populate('profile', 'businessName industry').sort({ createdAt: -1 });
    return res.status(200).json({ questions });
  } catch (err) { next(err); }
});
router.get('/profile/:profileId', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findById(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Business profile not found' });
    if (profile.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'You do not have permission to view questions for this profile' });
    const questions = await Question.find({ profile: req.params.profileId }).populate('investor', 'name email').sort({ createdAt: -1 });
    return res.status(200).json({ questions });
  } catch (err) { next(err); }
});
router.post('/:id/respond', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const { responseText } = req.body;
    if (!responseText || typeof responseText !== 'string' || responseText.trim().length === 0) return res.status(400).json({ error: 'Response text is required', field: 'responseText' });
    if (responseText.trim().length > 2000) return res.status(400).json({ error: 'Response must be 2000 characters or fewer', field: 'responseText' });
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    const profile = await BusinessProfile.findById(question.profile);
    if (!profile || profile.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'You do not have permission to respond to this question' });
    if (question.status !== 'Open') return res.status(409).json({ error: 'This question is no longer open for a response' });
    question.responseText = responseText.trim(); question.responseAt = new Date(); question.status = 'Answered';
    await question.save();
    return res.status(200).json({ question });
  } catch (err) { next(err); }
});
router.post('/:id/close', requireAuth, async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    const isInvestorOwner = question.investor.toString() === req.session.userId;
    let isFounderOwner = false;
    if (req.session.role === 'Founder') { const profile = await BusinessProfile.findById(question.profile); isFounderOwner = profile && profile.owner.toString() === req.session.userId; }
    if (!isInvestorOwner && !isFounderOwner) return res.status(403).json({ error: 'You do not have permission to close this question' });
    question.status = 'Closed';
    await question.save();
    return res.status(200).json({ question });
  } catch (err) { next(err); }
});
module.exports = router;