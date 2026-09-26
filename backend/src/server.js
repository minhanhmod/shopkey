import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import adminRoutes from "./routes/admin.js";
import topupRoutes from "./routes/topups.js";
import payosRoutes from "./routes/payos.js";

import { pool } from "./db/pool.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*"
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/topups", topupRoutes);
app.use("/api/payos", payosRoutes);

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");

    res.json({
      status: "ok",
      service: "PIXELKEY API",
      database: "connected",
      time: result.rows[0].now
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      status: "error",
      service: "PIXELKEY API",
      database: "disconnected"
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`PIXELKEY API running on port ${PORT}`);
});