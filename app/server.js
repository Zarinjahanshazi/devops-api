const express = require('express');
const promClient = require('prom-client');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// Prometheus metrics setup
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// Middleware
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  const id = uuidv4();
  req.requestId = id;
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    httpRequestsTotal.inc({ method: req.method, route: req.path, status: res.statusCode });
    logger.info('request', { id, method: req.method, url: req.path, status: res.statusCode, ms });
  });
  next();
});

// In-memory data store
const store = new Map();

// GET /status
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    version: process.env.APP_VERSION || '1.0.0',
    environment: NODE_ENV,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// POST /data
app.post('/data', (req, res) => {
  const { payload } = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'payload field required' });
  }
  const id = uuidv4();
  store.set(id, { id, payload, createdAt: new Date().toISOString() });
  logger.info('data saved', { id });
  res.status(201).json({ success: true, id, message: 'Data saved' });
});

// GET /data/:id
app.get('/data/:id', (req, res) => {
  const item = store.get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// GET /metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info('server started', { port: PORT, env: NODE_ENV });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;