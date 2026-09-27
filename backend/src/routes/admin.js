import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

/*
  POST /api/admin/users/:userId/balance

  Admin cộng tiền vào tài khoản user
*/
router.post("/users/:userId/balance", async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.params.userId);
    const amount = Number(req.body.amount);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "userId không hợp lệ"
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Số tiền phải lớn hơn 0"
      });
    }

    if (amount > 1000000000) {
      return res.status(400).json({
        message: "Số tiền quá lớn"
      });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE users
      SET
        balance = balance + $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        username,
        email,
        balance
      `,
      [amount, userId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Không tìm thấy user"
      });
    }

    await client.query("COMMIT");

    const user = result.rows[0];

    return res.json({
      message: "Cộng tiền thành công",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: Number(user.balance)
      },
      added: amount
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("ADMIN BALANCE ERROR:", error);

    return res.status(500).json({
      message: "Không thể cộng tiền"
    });

  } finally {
    client.release();
  }
});


/*
  GET /api/admin/users
  Danh sách user
*/
router.get("/users", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        username,
        email,
        role,
        balance,
        seller_discount_percent,
        is_active,
        created_at
      FROM users
      ORDER BY id DESC
    `);

    return res.json({
      users: result.rows
    });

  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách user"
    });
  }
});

// =====================================
// QUẢN LÝ SELLER
// =====================================

/*
  PUT /api/admin/users/:userId/role

  Admin nâng USER -> SELLER
  hoặc hạ SELLER -> USER
*/
router.put("/users/:userId/role", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const role = String(req.body.role || "").toLowerCase();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "userId không hợp lệ"
      });
    }

    if (!["user", "seller"].includes(role)) {
      return res.status(400).json({
        message: "Role chỉ được là user hoặc seller"
      });
    }

    // Không cho Admin tự thay đổi quyền của chính mình
    if (userId === Number(req.user.sub)) {
      return res.status(400).json({
        message: "Không thể thay đổi quyền của chính tài khoản admin"
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        role = $1,
        updated_at = NOW()
      WHERE id = $2
        AND role <> 'admin'
      RETURNING
        id,
        username,
        email,
        role,
        balance,
        seller_discount_percent,
        is_active
      `,
      [role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy user hoặc không thể thay đổi tài khoản admin"
      });
    }

    return res.json({
      message: role === "seller"
        ? "Đã nâng tài khoản thành Seller"
        : "Đã hạ tài khoản về User",

      user: result.rows[0]
    });

  } catch (error) {
    console.error("ADMIN CHANGE ROLE ERROR:", error);

    return res.status(500).json({
      message: "Không thể thay đổi quyền tài khoản"
    });
  }
});


/*
  PUT /api/admin/users/:userId/seller-discount

  Admin chỉnh % giảm giá cho Seller
*/
router.put("/users/:userId/seller-discount", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const discount = Number(req.body.discount_percent);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "userId không hợp lệ"
      });
    }

    if (!Number.isFinite(discount) || discount < 0 || discount > 90) {
      return res.status(400).json({
        message: "Mức giảm phải từ 0% đến 90%"
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        seller_discount_percent = $1,
        updated_at = NOW()
      WHERE id = $2
        AND role = 'seller'
      RETURNING
        id,
        username,
        email,
        role,
        balance,
        seller_discount_percent,
        is_active
      `,
      [discount, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy Seller"
      });
    }

    return res.json({
      message: "Đã cập nhật mức giảm giá Seller",
      user: result.rows[0]
    });

  } catch (error) {
    console.error("ADMIN SELLER DISCOUNT ERROR:", error);

    return res.status(500).json({
      message: "Không thể cập nhật mức giảm giá Seller"
    });
  }
});
router.put("/users/:userId/status", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const isActive = Boolean(req.body.is_active);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "userId không hợp lệ"
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        is_active = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        username,
        email,
        role,
        balance,
        is_active
      `,
      [isActive, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy user"
      });
    }

    return res.json({
      message: isActive
        ? "Đã mở khóa tài khoản"
        : "Đã khóa tài khoản",

      user: result.rows[0]
    });

  } catch (error) {

    console.error(
      "ADMIN USER STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể thay đổi trạng thái user"
    });
  }
});


// =====================================
// TẤT CẢ ĐƠN HÀNG
// =====================================

router.get("/orders", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        o.id,
        o.order_code,
        o.user_id,
        u.username,
        u.email,
        o.subtotal,
        o.discount,
        o.total,
        o.payment_method,
        o.status,
        o.created_at,
        o.updated_at
      FROM orders o
      LEFT JOIN users u
        ON u.id = o.user_id
      ORDER BY o.created_at DESC
      LIMIT 200
    `);

    return res.json({
      orders: result.rows
    });

  } catch (error) {

    console.error(
      "ADMIN ORDERS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy danh sách đơn hàng"
    });
  }
});


// =====================================
// THỐNG KÊ GAME KEY
// =====================================

router.get("/stats", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM game_keys) AS keys,
        (SELECT COUNT(*) FROM game_keys
         WHERE status = 'available') AS available_keys,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COALESCE(SUM(total), 0)
         FROM orders
         WHERE status = 'completed') AS revenue
    `);

    return res.json({
      stats: result.rows[0]
    });

  } catch (error) {

    console.error(
      "ADMIN STATS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy thống kê"
    });
  }
});

export default router;
