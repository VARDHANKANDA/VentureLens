'use strict';
const express = require('express');
const BusinessProfile = require('../models/BusinessProfile');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const router = express.Router();
function validateFundingGoal(value) {
  if (value === undefined || value === null || value === '') return null;
  const fg = Number(value);
  if (isNaN(fg) || fg < 0.01 || fg > 999999999.99) return false;
  return fg;
}
router.post('/', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const { businessName, description, industry, stage, businessModel, problemStatement, solutionStatement, targetCustomers, revenueContext, fundingGoal, useOfFunds, milestones } = req.body;
    if (!businessName || typeof businessName !== 'string' || businessName.trim().length === 0) return res.status(400).json({ error: 'Business name is required', field: 'businessName' });
    if (businessName.trim().length > 200) return res.status(400).json({ error: 'Business name must be 200 characters or fewer', field: 'businessName' });
    if (!description || typeof description !== 'string' || description.trim().length === 0) return res.status(400).json({ error: 'Description is required', field: 'description' });
    if (description.trim().length > 2000) return res.status(400).json({ error: 'Description must be 2000 characters or fewer', field: 'description' });
    const fg = validateFundingGoal(fundingGoal);
    if (fg === false) return res.status(400).json({ error: 'Funding goal must be between 0.01 and 999,999,999.99', field: 'fundingGoal' });
    const profile = await BusinessProfile.create({ owner: req.session.userId, businessName: businessName.trim(), description: description.trim(), industry: (industry||'').trim(), stage: (stage||'').trim(), businessModel: (businessModel||'').trim(), problemStatement: (problemStatement||'').trim(), solutionStatement: (solutionStatement||'').trim(), targetCustomers: (targetCustomers||'').trim(), revenueContext: (revenueContext||'').trim(), fundingGoal: fg, useOfFunds: (useOfFunds||'').trim(), milestones: (milestones||'').trim() });
    return res.status(201).json({ profile });
  } catch (err) { next(err); }
});
router.get('/mine', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try { const profile = await BusinessProfile.findOne({ owner: req.session.userId }); return res.status(200).json({ profile: profile || null }); } catch (err) { next(err); }
});
router.get('/', requireAuth, requireRole('Investor'), async (req, res, next) => {
  try { const profiles = await BusinessProfile.find({ publicationStatus: 'Published' }).select('businessName industry stage description fundingGoal publicationStatus updatedAt').sort({ updatedAt: -1 }); return res.status(200).json({ profiles }); } catch (err) { next(err); }
});
router.get('/:id', requireAuth, requireRole('Investor'), async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Business profile not found' });
    if (profile.publicationStatus !== 'Published') return res.status(403).json({ error: 'This business profile is not available' });
    return res.status(200).json({ profile });
  } catch (err) { next(err); }
});
router.put('/:id/toggle-publication', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Business profile not found' });
    if (profile.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    profile.publicationStatus = profile.publicationStatus === 'Published' ? 'Unpublished' : 'Published';
    await profile.save();
    return res.status(200).json({ publicationStatus: profile.publicationStatus, profile });
  } catch (err) { next(err); }
});
router.put('/:id', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Business profile not found' });
    if (profile.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    const { businessName, description, fundingGoal } = req.body;
    if (businessName !== undefined) { if (typeof businessName !== 'string' || businessName.trim().length === 0) return res.status(400).json({ error: 'Business name cannot be empty', field: 'businessName' }); if (businessName.trim().length > 200) return res.status(400).json({ error: 'Business name must be 200 characters or fewer', field: 'businessName' }); profile.businessName = businessName.trim(); }
    if (description !== undefined) { if (typeof description !== 'string' || description.trim().length === 0) return res.status(400).json({ error: 'Description cannot be empty', field: 'description' }); if (description.trim().length > 2000) return res.status(400).json({ error: 'Description must be 2000 characters or fewer', field: 'description' }); profile.description = description.trim(); }
    if (fundingGoal !== undefined) { if (fundingGoal === null || fundingGoal === '') { profile.fundingGoal = null; } else { const fg = validateFundingGoal(fundingGoal); if (fg === false) return res.status(400).json({ error: 'Funding goal must be between 0.01 and 999,999,999.99', field: 'fundingGoal' }); profile.fundingGoal = fg; } }
    const textFields = ['industry','stage','businessModel','problemStatement','solutionStatement','targetCustomers','revenueContext','useOfFunds','milestones'];
    for (const f of textFields) { if (req.body[f] !== undefined) profile[f] = (req.body[f] || '').trim(); }
    await profile.save();
    return res.status(200).json({ profile });
  } catch (err) { next(err); }
});
router.delete('/:id', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Business profile not found' });
    if (profile.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    await profile.deleteOne();
    return res.status(200).json({ message: 'Business profile deleted' });
  } catch (err) { next(err); }
});
module.exports = router;