'use strict';
const express = require('express');
const EvidenceRecord = require('../models/EvidenceRecord');
const BusinessProfile = require('../models/BusinessProfile');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const router = express.Router();
const VALID_STATUSES = ['Missing', 'Provided', 'Awaiting Review', 'Outdated'];
router.post('/', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const { profileId, title, category, relatedSection, description, documentReference, status } = req.body;
    if (!profileId) return res.status(400).json({ error: 'profileId is required', field: 'profileId' });
    if (!title || typeof title !== 'string' || title.trim().length === 0) return res.status(400).json({ error: 'Title is required', field: 'title' });
    if (title.trim().length > 200) return res.status(400).json({ error: 'Title must be 200 characters or fewer', field: 'title' });
    if (!category || typeof category !== 'string' || category.trim().length === 0) return res.status(400).json({ error: 'Category is required', field: 'category' });
    if (!relatedSection || typeof relatedSection !== 'string' || relatedSection.trim().length === 0) return res.status(400).json({ error: 'Related section is required', field: 'relatedSection' });
    if (!status || !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Status must be Missing, Provided, Awaiting Review, or Outdated', field: 'status' });
    const profile = await BusinessProfile.findById(profileId);
    if (!profile) return res.status(404).json({ error: 'Business profile not found' });
    if (profile.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'You do not have permission to add evidence to this profile' });
    const record = await EvidenceRecord.create({ profile: profileId, owner: req.session.userId, title: title.trim(), category: category.trim(), relatedSection: relatedSection.trim(), description: (description||'').trim(), documentReference: (documentReference||'').trim(), status });
    return res.status(201).json({ record });
  } catch (err) { next(err); }
});
router.get('/:profileId', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findById(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Business profile not found' });
    if (profile.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'You do not have permission to view evidence for this profile' });
    const records = await EvidenceRecord.find({ profile: req.params.profileId }).sort({ createdAt: 1 });
    return res.status(200).json({ records });
  } catch (err) { next(err); }
});
router.put('/:id', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const record = await EvidenceRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Evidence record not found' });
    if (record.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'You do not have permission to modify this evidence record' });
    const { title, category, relatedSection, description, documentReference, status } = req.body;
    if (title !== undefined) { if (typeof title !== 'string' || title.trim().length === 0) return res.status(400).json({ error: 'Title cannot be empty', field: 'title' }); if (title.trim().length > 200) return res.status(400).json({ error: 'Title must be 200 characters or fewer', field: 'title' }); record.title = title.trim(); }
    if (category !== undefined) record.category = (category||'').trim();
    if (relatedSection !== undefined) record.relatedSection = (relatedSection||'').trim();
    if (description !== undefined) record.description = (description||'').trim();
    if (documentReference !== undefined) record.documentReference = (documentReference||'').trim();
    if (status !== undefined) { if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status', field: 'status' }); record.status = status; }
    await record.save();
    return res.status(200).json({ record });
  } catch (err) { next(err); }
});
router.delete('/:id', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const record = await EvidenceRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Evidence record not found' });
    if (record.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'You do not have permission to delete this evidence record' });
    await record.deleteOne();
    return res.status(200).json({ message: 'Evidence record deleted' });
  } catch (err) { next(err); }
});
module.exports = router;