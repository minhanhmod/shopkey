import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { payos } from "../utils/payos.js";

const router = express.Router();

function generateOrderCode() {
  return Date.now();
}

// Tạo đơn nạp tiền
router.post("/", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount)) {
      return res.status(400).json({
        message: "Số tiền không hợp lệ"
      });
    }

    if (amount < 10000) {
      return res.status(400).json({
        message: "Số tiền nạp tối thiểu là 10.000đ"
      });
    }

    if (amount > 50000000) {
      return res.status(400).json({
        message: "Số tiền nạp tối đa là 50.000.000đ"
      });
    }

    const orderCode = generateOrderCode();

    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:5500";

    await client.query("BEGIN");

    const insertResult = await client.query(
      `
      INSERT INTO topup_orders
      (
        user_id,
        order_code,
        amount,
        status
      )
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
      `,
      [req.user.sub, orderCode, amount]
    );

    const topup = insertResult.rows[0];

    const paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount,
      description: `NAP PIXELKEY ${orderCode}`,
      cancelUrl: `${frontendUrl}/account.html?payment=cancel`,
      returnUrl: `${frontendUrl}/account.html?payment=success`,
      expiredAt: Math.floor(Date.now() / 1000) + 15 * 60
    });

    await client.query(
      `
      UPDATE topup_orders
      SET
        payment_link_id = $1,
        checkout_url = $2,
        qr_code = $3,
        updated_at = NOW()
      WHERE id = $4
      `,
      [
        paymentLink.paymentLinkId || null,
        paymentLink.checkoutUrl || null,
        paymentLink.qrCode || null,
        topup.id
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Tạo đơn nạp tiền thành công",
      orderCode,
      amount,
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
      paymentLinkId: paymentLink.paymentLinkId
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create topup error:", error);

    res.status(500).json({
      message: "Không thể tạo đơn nạp tiền",
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Xem trạng thái một đơn nạp
router.get("/:orderCode", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        order_code,
        amount,
        status,
        payment_link_id,
        checkout_url,
        qr_code,
        paid_at,
        created_at,
        updated_at
      FROM topup_orders
      WHERE order_code = $1
        AND user_id = $2
      LIMIT 1
      `,
      [req.params.orderCode, req.user.sub]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy đơn nạp tiền"
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get topup error:", error);

    res.status(500).json({
      message: "Không thể lấy thông tin đơn nạp"
    });
  }
});

// Lịch sử nạp tiền
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        order_code,
        amount,
        status,
        checkout_url,
        paid_at,
        created_at
      FROM topup_orders
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [req.user.sub]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get topup history error:", error);

    res.status(500).json({
      message: "Không thể lấy lịch sử nạp tiền"
    });
  }
});

export default router;