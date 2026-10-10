'use strict';
const mongoose = require('mongoose');
const evidenceRecordSchema = new mongoose.Schema({
  profile: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 200, trim: true },
  category: { type: String, required: true, trim: true },
  relatedSection: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  documentReference: { type: String, default: '', trim: true },
  status: { type: String, enum: ['Missing', 'Provided', 'Awaiting Review', 'Outdated'], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
evidenceRecordSchema.pre('save', function () { this.updatedAt = Date.now(); });
module.exports = mongoose.model('EvidenceRecord', evidenceRecordSchema);