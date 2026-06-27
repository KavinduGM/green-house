import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { config, hasClaude } from './config.js';
import { db, seed } from './db.js';
import { requireAuth } from './auth.js';
import { resolveProject } from './project.js';
import { startMqtt } from './mqtt.js';
import { attachRealtime } from './realtime.js';
import { startScheduler } from './services/scheduler.js';

import { authRouter } from './routes/auth.js';
import { gardenRouter } from './routes/garden.js';
import { trackingRouter } from './routes/tracking.js';
import { iotRouter } from './routes/iot.js';
import { aiRouter } from './routes/ai.js';
import { dashboardRouter } from './routes/dashboard.js';
import { projectsRouter } from './routes/projects.js';

seed();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// uploaded photos (diagrams, defect/event images)
app.use('/uploads', express.static(config.uploadDir));
// firmware binaries for OTA (ESP32 downloads from here) — public, no auth
app.use('/firmware', express.static(config.firmwareDir));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, ai: hasClaude(), time: new Date().toISOString() }),
);

// public
app.use('/api/auth', authRouter);

// everything else requires a token + a resolved project (X-Project-Id header)
app.use('/api', requireAuth);
app.use('/api', resolveProject);
app.use('/api', projectsRouter);
app.use('/api', gardenRouter);
app.use('/api', trackingRouter);
app.use('/api', iotRouter);
app.use('/api/ai', aiRouter);
app.use('/api', dashboardRouter);

// serve the built app if present (single-box deploy)
app.use(express.static('public'));
app.get(/^(?!\/api|\/uploads|\/ws).*/, (_req, res) => {
  res.sendFile('index.html', { root: 'public' }, () => res.status(404).end());
});

const server = http.createServer(app);
attachRealtime(server);

server.listen(config.port, () => {
  console.log(`[api]  http://0.0.0.0:${config.port}`);
  console.log(`[ai]   Claude ${hasClaude() ? 'ENABLED (' + config.anthropicModel + ')' : 'DISABLED — set ANTHROPIC_API_KEY'}`);
  console.log(`[db]   ${config.dbPath}`);
});

startMqtt();
startScheduler();

process.on('SIGINT', () => { db.close(); process.exit(0); });
