import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/shared/config/db.js';

// Connect to MongoDB immediately at startup (Mongoose buffers queries automatically)
connectDatabase().catch((err) => {
  console.error('Database connection failed:', err);
});

const app = createApp();

export default app;
