'use strict';
const mongoose = require('mongoose');
const businessProfileSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessName: { type: String, required: true, maxlength: 200, trim: true },
  description: { type: String, required: true, maxlength: 2000, trim: true },
  industry: { type: String, default: '', trim: true },
  stage: { type: String, default: '', trim: true },
  businessModel: { type: String, default: '', trim: true },
  problemStatement: { type: String, default: '', trim: true },
  solutionStatement: { type: String, default: '', trim: true },
  targetCustomers: { type: String, default: '', trim: true },
  revenueContext: { type: String, default: '', trim: true },
  fundingGoal: { type: Number, default: null },
  useOfFunds: { type: String, default: '', trim: true },
  milestones: { type: String, default: '', trim: true },
  publicationStatus: { type: String, enum: ['Published', 'Unpublished'], default: 'Unpublished' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
businessProfileSchema.pre('save', function () { this.updatedAt = Date.now(); });
module.exports = mongoose.model('BusinessProfile', businessProfileSchema);