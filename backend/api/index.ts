import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/shared/config/db.js';
import mongoose from 'mongoose';

const app = createApp();

let isConnected = false;

async function ensureConnected() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  await connectDatabase();
  isConnected = true;
}

export default async function handler(req: any, res: any) {
  try {
    await ensureConnected();
    app(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}
