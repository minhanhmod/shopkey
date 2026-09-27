import express from "express";
import crypto from "crypto";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/*
  POST /api/orders
  Mua một sản phẩm bằng số dư tài khoản
*/
router.post("/", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.sub;
    const productId = Number(req.body.product_id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        message: "product_id không hợp lệ"
      });
    }

    await client.query("BEGIN");

    // Khóa user để tránh 2 giao dịch trừ tiền cùng lúc
    const userResult = await client.query(
      `
      SELECT
  id,
  username,
  balance,
  is_active,
  role,
  seller_discount_percent
FROM users
WHERE id = $1
FOR UPDATE
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Không tìm thấy tài khoản"
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        message: "Tài khoản đã bị khóa"
      });
    }

    // Khóa sản phẩm
    const productResult = await client.query(
      `
      SELECT id, name, price, stock, is_active
      FROM products
      WHERE id = $1
      FOR UPDATE
      `,
      [productId]
    );

    if (productResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Không tìm thấy sản phẩm"
      });
    }

    const product = productResult.rows[0];

    if (!product.is_active) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Sản phẩm hiện không được bán"
      });
    }

    if (product.stock <= 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Sản phẩm đã hết hàng"
      });
    }

const originalPrice = Number(product.price);

const sellerDiscountPercent =
  user.role === "seller"
    ? Number(user.seller_discount_percent || 0)
    : 0;

const discount = Number(
  (originalPrice * sellerDiscountPercent / 100).toFixed(2)
);

const price = Number(
  (originalPrice - discount).toFixed(2)
);

const balance = Number(user.balance);

    if (balance < price) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Số dư không đủ",
        balance,
        required: price,
        missing: Number((price - balance).toFixed(2))
      });
    }

    /*
      Lấy đúng 1 key còn available.
      FOR UPDATE SKIP LOCKED giúp tránh 2 người
      lấy cùng một key khi mua đồng thời.
    */
    const keyResult = await client.query(
      `
      SELECT id, key_value
      FROM game_keys
      WHERE product_id = $1
        AND status = 'available'
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
      `,
      [productId]
    );

    if (keyResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Không còn game key khả dụng"
      });
    }

    const gameKey = keyResult.rows[0];

    const orderCode =
      `PK-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // Tạo order
    const orderResult = await client.query(
      `
      INSERT INTO orders
        (
          user_id,
          order_code,
          subtotal,
          discount,
          total,
          payment_method,
          status
        )
      VALUES
        ($1, $2, $3, 0, $3, 'balance', 'completed')
      RETURNING
        id,
        user_id,
        order_code,
        subtotal,
        discount,
        total,
        payment_method,
        status,
        created_at
      `,
      [
        userId,
        orderCode,
        price
      ]
    );

    const order = orderResult.rows[0];

    // Trừ tiền
    const newBalance = balance - price;

    await client.query(
      `
      UPDATE users
      SET balance = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [newBalance, userId]
    );

    // Đánh dấu key đã bán
    await client.query(
      `
      UPDATE game_keys
      SET
        status = 'sold',
        order_id = $1,
        sold_to_user_id = $2,
        sold_at = NOW()
      WHERE id = $3
      `,
      [
        order.id,
        userId,
        gameKey.id
      ]
    );

    // Giảm stock
    await client.query(
      `
      UPDATE products
      SET stock = stock - 1
      WHERE id = $1
      `,
      [productId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Mua game thành công",

      order: {
        id: order.id,
        order_code: order.order_code,
        product_id: product.id,
        product_name: product.name,
        price: price,
        total: price,
        status: order.status,
        payment_method: order.payment_method,
        created_at: order.created_at
      },

      game_key: gameKey.key_value,

      balance: Number(newBalance.toFixed(2)),

      stock: product.stock - 1
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("BUY GAME ERROR:", error);

    return res.status(500).json({
      message: "Không thể mua game",
      error: error.message
    });

  } finally {
    client.release();
  }
});


/*
  GET /api/orders
  Lịch sử đơn hàng của user
*/
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        o.id,
        o.order_code,
        o.subtotal,
        o.discount,
        o.total,
        o.payment_method,
        o.status,
        o.created_at,

        COALESCE(
          json_agg(
            json_build_object(
              'product_id', p.id,
              'product_name', p.name,
              'key', g.key_value
            )
          ) FILTER (WHERE g.id IS NOT NULL),
          '[]'
        ) AS items

      FROM orders o

      LEFT JOIN game_keys g
        ON g.order_id = o.id

      LEFT JOIN products p
        ON p.id = g.product_id

      WHERE o.user_id = $1

      GROUP BY o.id

      ORDER BY o.created_at DESC
      `,
      [req.user.sub]
    );

    return res.json({
      orders: result.rows
    });

  } catch (error) {
    console.error("GET ORDERS ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy lịch sử đơn hàng"
    });
  }
});


/*
  GET /api/orders/:id
  Xem chi tiết một đơn hàng của chính user
*/
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: "ID đơn hàng không hợp lệ"
      });
    }

    const result = await pool.query(
      `
      SELECT
        o.id,
        o.order_code,
        o.subtotal,
        o.discount,
        o.total,
        o.payment_method,
        o.status,
        o.created_at,

        g.id AS key_id,
        g.key_value,

        p.id AS product_id,
        p.name AS product_name

      FROM orders o

      LEFT JOIN game_keys g
        ON g.order_id = o.id

      LEFT JOIN products p
        ON p.id = g.product_id

      WHERE o.id = $1
        AND o.user_id = $2
      `,
      [
        orderId,
        req.user.sub
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng"
      });
    }

    const row = result.rows[0];

    return res.json({
      order: {
        id: row.id,
        order_code: row.order_code,
        subtotal: row.subtotal,
        discount: row.discount,
        total: row.total,
        payment_method: row.payment_method,
        status: row.status,
        created_at: row.created_at
      },

      item: row.key_id
        ? {
            product_id: row.product_id,
            product_name: row.product_name,
            game_key: row.key_value
          }
        : null
    });

  } catch (error) {
    console.error("GET ORDER ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy đơn hàng"
    });
  }
});

export default router;
