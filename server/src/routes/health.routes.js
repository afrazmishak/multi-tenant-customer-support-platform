import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (req, res) => {
  const isDatabaseConnected = mongoose.connection.readyState === 1;

  const statusCode = isDatabaseConnected ? 200 : 503;

  res.status(statusCode).json({
    success: isDatabaseConnected,
    message: isDatabaseConnected
      ? "Customer Support Platform API is healthy"
      : "API is running, but the database is unavailable",
    services: {
      appi: "operational",
      database: isDatabaseConnected ? "connected" : "disconnected",
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;