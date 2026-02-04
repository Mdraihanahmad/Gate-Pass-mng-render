import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { startDailyRetentionJob, startOverstayMonitor } from './jobs/retention.js';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  // Start daily auto-retention purge (3 months)
  startDailyRetentionJob();
  // Start overstay monitor (checks every 30 minutes)
  startOverstayMonitor();
});
