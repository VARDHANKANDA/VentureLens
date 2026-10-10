'use strict';
const mongoose = require('mongoose');
const questionSchema = new mongoose.Schema({
  profile: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile', required: true, index: true },
  investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, maxlength: 1000, trim: true },
  sectionReference: { type: String, default: '', maxlength: 100, trim: true },
  status: { type: String, enum: ['Open', 'Answered', 'Closed'], default: 'Open', required: true },
  responseText: { type: String, default: null, maxlength: 2000 },
  responseAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
questionSchema.pre('save', function () { this.updatedAt = Date.now(); });
module.exports = mongoose.model('Question', questionSchema);