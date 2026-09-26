const express = require("express");
const cors = require("cors");
const path = require("path");
const { initDB } = require("./db");

const fs = require("fs");

// Import routers (reloaded)
const { router: authRouter } = require("./routes/auth");
const campaignsRouter = require("./routes/campaigns");
const registrationsRouter = require("./routes/registrations");
const uploadRouter = require("./routes/upload");
const analyticsRouter = require("./routes/analytics");
const auditRouter = require("./routes/audit");

const testTemplatesRouter = require("./routes/testTemplates");

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "https://camp.janjyotieyehospital.com",
        "http://camp.janjyotieyehospital.com",
        process.env.CLIENT_URL,
      ].filter(Boolean);

      const isLocalIp =
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
          origin,
        );

      const isAllowedDomain =
        /^https?:\/\/([a-zA-Z0-9-]+\.)*janjyotieyehospital\.com(:\d+)?$/.test(origin);

      if (isLocalIp || isAllowedDomain || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Mount routes
app.use("/api/auth", authRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/registrations", registrationsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/test-templates", testTemplatesRouter);

// Basic health check route
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// Optionally serve frontend static build if dist folder is placed in Backend
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/health")
    ) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS error: Origin not allowed" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "An unexpected server error occurred" });
});

// Initialize DB and start server
async function startServer() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`Backend server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error(
      "Server startup failed due to database connection issue:",
      err,
    );
    process.exit(1);
  }
}

startServer();
