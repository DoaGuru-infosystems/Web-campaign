const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

// Import routers (reloaded)
const { router: authRouter } = require('./routes/auth');
const campaignsRouter = require('./routes/campaigns');
const registrationsRouter = require('./routes/registrations');
const uploadRouter = require('./routes/upload');
const analyticsRouter = require('./routes/analytics');
const auditRouter = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    process.env.CLIENT_URL
  ].filter(Boolean),
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/audit', auditRouter);

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred' });
});

// Initialize DB and start server
async function startServer() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`Backend server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Server startup failed due to database connection issue:', err);
    process.exit(1);
  }
}

startServer();
