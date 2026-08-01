import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/shared/config/db.js';
import mongoose from 'mongoose';

const app = createApp();

// Serverless DB middleware: awaits connection inside the request lifecycle so CPU is not frozen
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDatabase();
    } catch (err) {
      console.error('Database connection failed in serverless middleware:', err);
      return res.status(500).json({ success: false, error: 'Database connection failed' });
    }
  }
  next();
});

export default app;
