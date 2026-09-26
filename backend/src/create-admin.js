import dotenv from "dotenv";
import readline from "readline";
import { pool } from "./db/pool.js";
import { hashPassword } from "./utils/auth.js";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

async function createAdmin() {
  try {
    console.log("");
    console.log("=================================");
    console.log("       PIXELKEY CREATE ADMIN");
    console.log("=================================");
    console.log("");

    const username = (await question("Username admin: ")).trim();
    const email = (await question("Email admin: ")).trim().toLowerCase();
    const password = await question("Password admin: ");

    if (!username || !email || !password) {
      console.log("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    if (password.length < 8) {
      console.log("Mật khẩu admin phải có ít nhất 8 ký tự.");
      return;
    }

    const existing = await pool.query(
      `
      SELECT id, username, email
      FROM users
      WHERE LOWER(username) = LOWER($1)
         OR LOWER(email) = LOWER($2)
      LIMIT 1
      `,
      [username, email]
    );

    if (existing.rows.length > 0) {
      console.log("");
      console.log("Username hoặc email đã tồn tại.");
      console.log(existing.rows[0]);
      return;
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `
      INSERT INTO users
        (username, email, password_hash, role, balance)
      VALUES
        ($1, $2, $3, 'admin', 0)
      RETURNING
        id,
        username,
        email,
        role,
        balance,
        created_at
      `,
      [username, email, passwordHash]
    );

    console.log("");
    console.log("=================================");
    console.log("       TẠO ADMIN THÀNH CÔNG");
    console.log("=================================");
    console.log("");
    console.log(result.rows[0]);
    console.log("");

  } catch (error) {
    console.error("");
    console.error("LỖI TẠO ADMIN:");
    console.error(error);
  } finally {
    rl.close();
    await pool.end();
  }
}

createAdmin();