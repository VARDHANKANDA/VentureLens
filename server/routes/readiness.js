'use strict';
const express = require('express');
const BusinessProfile = require('../models/BusinessProfile');
const EvidenceRecord = require('../models/EvidenceRecord');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { computeReadiness } = require('../utils/readiness');
const router = express.Router();
router.get('/:profileId', requireAuth, requireRole('Founder'), async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findById(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Business profile not found' });
    if (profile.owner.toString() !== req.session.userId) return res.status(403).json({ error: 'You do not have permission to view this readiness report' });
    const hasEvidence = await EvidenceRecord.exists({ profile: profile._id });
    const result = computeReadiness(profile.toObject(), !!hasEvidence);
    return res.status(200).json({ completenessPercentage: result.percentage, completedCount: result.completed, totalSections: result.total, incompleteItems: result.incompleteItems });
  } catch (err) { next(err); }
});
module.exports = router;