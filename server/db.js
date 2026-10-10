'use strict';

const mongoose = require('mongoose');

let internalMongoServer = null;

async function connectDB(uri) {
  let connectionUri = uri || process.env.MONGO_URI;

  if (connectionUri && !connectionUri.includes('localhost:27017')) {
    try {
      await mongoose.connect(connectionUri, { serverSelectionTimeoutMS: 5000 });
      console.log('MongoDB connected successfully at:', connectionUri);
      return;
    } catch (err) {
      console.error('MongoDB connection error to configured URI:', err.message);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }

  // If local standalone service is not configured or in dev mode:
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    const { MongoMemoryServer } = require('mongodb-memory-server');
    internalMongoServer = await MongoMemoryServer.create();
    const embeddedUri = internalMongoServer.getUri();
    process.env.MONGO_URI = embeddedUri;
    await mongoose.connect(embeddedUri);
    console.log('Embedded MongoDB engine connected at:', embeddedUri);
  } catch (innerErr) {
    console.error('Failed to start MongoDB engine:', innerErr.message);
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (internalMongoServer) {
    await internalMongoServer.stop();
  }
}

module.exports = { connectDB, disconnectDB };