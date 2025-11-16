// Load environment variables from .env file if it exists (optional in production)
try {
  require('dotenv').config();
} catch (error) {
  // .env file not found - using environment variables from system/Coolify
  console.log('No .env file found - using system environment variables');
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { pool, initializeDatabase } = require('./src/config/database');
const { redisClient } = require('./src/config/redis');
const logger = require('./src/config/logger');

// Import routes
const uploadRoute = require('./src/routes/upload');
const analyseRoute = require('./src/routes/analyse');
const generateRoute = require('./src/routes/generate');
const chatRoute = require('./src/routes/chat');
const downloadRoute = require('./src/routes/download');
const githubRoute = require('./src/routes/github');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 4004;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    const dbStatus = 'connected';

    // Check Redis
    const redisStatus = redisClient.isReady ? 'connected' : 'disconnected';

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: redisStatus,
      version: '3.0.0',
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// API Routes
app.use('/api/upload', uploadRoute);
app.use('/api/analyse', analyseRoute);
app.use('/api/generate', generateRoute);
app.use('/api/chat', chatRoute);
app.use('/api/download', downloadRoute);
app.use('/api/github', githubRoute);

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, project_type, status, created_at, updated_at FROM projects ORDER BY created_at DESC LIMIT 50'
    );
    res.json({
      success: true,
      projects: result.rows,
    });
  } catch (error) {
    logger.error('Failed to get projects', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get projects',
    });
  }
});

// Get single project
app.get('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    res.json({
      success: true,
      project: result.rows[0],
    });
  } catch (error) {
    logger.error('Failed to get project', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get project',
    });
  }
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    logger.info('Client joined project room', { socketId: socket.id, projectId });
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

// Make io available to routes
app.set('io', io);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await pool.end();
    await redisClient.quit();
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('✅ Database initialized');

    // Test database connection
    await pool.query('SELECT NOW()');
    logger.info('✅ Database connection verified');

    // Start server
    server.listen(PORT, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           🚀 Command Agent v3 Server Running              ║
║                                                            ║
║  Server:     http://localhost:${PORT}                        ║
║  Health:     http://localhost:${PORT}/api/health            ║
║  Frontend:   http://localhost:${PORT}/                       ║
║                                                            ║
║  📋 API Endpoints:                                         ║
║    POST   /api/upload          Upload requirements        ║
║    POST   /api/analyse         Analyse requirements       ║
║    POST   /api/generate        Generate code              ║
║    POST   /api/chat            Chat about project         ║
║    GET    /api/download/:id    Download ZIP               ║
║    POST   /api/github/push     Push to GitHub             ║
║    GET    /api/projects        List all projects          ║
║    GET    /api/health          Health check               ║
║                                                            ║
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
║  Database:    Connected ✅                                 ║
║  Redis:       ${redisClient.isReady ? 'Connected ✅' : 'Disconnected ⚠️ '}                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

startServer();
