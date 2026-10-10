'use strict';
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['Founder', 'Investor'], required: true },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash; delete obj.loginAttempts; delete obj.lockUntil;
  return obj;
};
module.exports = mongoose.model('User', userSchema);