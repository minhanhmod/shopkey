import express from "express";

import { pool } from "../db/pool.js";
import {
  hashPassword,
  comparePassword,
  createToken
} from "../utils/auth.js";

import { requireAuth } from "../middleware/auth.js";

const router = express.Router();


// =====================================================
// REGISTER
// =====================================================

router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password
    } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ thông tin"
      });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({
        message: "Username phải từ 3 đến 50 ký tự"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Mật khẩu phải có ít nhất 6 ký tự"
      });
    }

    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(username) = LOWER($1)
         OR LOWER(email) = LOWER($2)
      LIMIT 1
      `,
      [username.trim(), email.trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Username hoặc email đã tồn tại"
      });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `
      INSERT INTO users
        (username, email, password_hash)
      VALUES
        ($1, $2, $3)
      RETURNING
        id,
        username,
        email,
        role,
        balance,
        created_at
      `,
      [
        username.trim(),
        email.trim().toLowerCase(),
        passwordHash
      ]
    );

    const user = result.rows[0];

    const token = createToken(user);

    res.status(201).json({
      message: "Đăng ký thành công",
      token,
      user
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
});


// =====================================================
// LOGIN
// =====================================================

router.post("/login", async (req, res) => {
  try {
    const {
      username,
      password
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập username và mật khẩu"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        email,
        password_hash,
        role,
        balance,
        is_active,
        created_at
      FROM users
      WHERE LOWER(username) = LOWER($1)
         OR LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Thông tin đăng nhập không chính xác"
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa"
      });
    }

    const passwordValid = await comparePassword(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        message: "Thông tin đăng nhập không chính xác"
      });
    }

    delete user.password_hash;

    const token = createToken(user);

    res.json({
      message: "Đăng nhập thành công",
      token,
      user
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
});


// =====================================================
// ME
// =====================================================

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        username,
        email,
        role,
        balance,
        is_active,
        created_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.user.sub]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản"
      });
    }

    res.json({
      user: result.rows[0]
    });

  } catch (error) {
    console.error("ME ERROR:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
});


export default router;