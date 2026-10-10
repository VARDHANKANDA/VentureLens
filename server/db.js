'use strict';

const mongoose = require('mongoose');

async function connectDB(uri) {
  const connectionUri = uri || process.env.MONGO_URI;
  try {
    await mongoose.connect(connectionUri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();}

module.exports = { connectDB, disconnectDB };