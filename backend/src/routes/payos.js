import express from "express";
import { pool } from "../db/pool.js";
import { payos } from "../utils/payos.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

/*
 * PAYOS WEBHOOK
 * PayOS gọi endpoint này khi giao dịch thay đổi trạng thái.
 */
router.post("/webhook", async (req, res) => {
console.log("PAYOS WEBHOOK RECEIVED");
console.log("BODY:", JSON.stringify(req.body));
console.log("HEADERS:", {
  "content-type": req.headers["content-type"],
  "user-agent": req.headers["user-agent"]
});
  const client = await pool.connect();

  try {
    // Xác thực webhook từ PayOS
    const webhookData = await payos.webhooks.verify(req.body);

    const orderCode = Number(webhookData.orderCode);
    const amount = Number(webhookData.amount);

    if (!orderCode || !amount) {
      return res.status(400).json({
        message: "Webhook data không hợp lệ"
      });
    }

    await client.query("BEGIN");

    // Khóa đơn nạp tiền để tránh cộng tiền 2 lần
    const topupResult = await client.query(
      `
      SELECT *
      FROM topup_orders
      WHERE order_code = $1
      FOR UPDATE
      `,
      [orderCode]
    );

    if (topupResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Không tìm thấy đơn nạp tiền"
      });
    }

    const topup = topupResult.rows[0];

    // Nếu đã thanh toán trước đó thì không cộng tiền lần nữa
    if (topup.status === "paid") {
      await client.query("COMMIT");

      return res.json({
        message: "Đơn này đã được xử lý"
      });
    }

    // Kiểm tra số tiền
    if (Number(topup.amount) !== amount) {
      await client.query("ROLLBACK");

      console.error("PAYOS AMOUNT MISMATCH", {
        orderCode,
        databaseAmount: topup.amount,
        webhookAmount: amount
      });

      return res.status(400).json({
        message: "Số tiền thanh toán không khớp"
      });
    }

    // Khóa user
    const userResult = await client.query(
      `
      SELECT id, balance
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [topup.user_id]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Không tìm thấy người dùng"
      });
    }

    // Cộng tiền
    await client.query(
      `
      UPDATE users
      SET
        balance = balance + $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [topup.amount, topup.user_id]
    );

    // Đánh dấu đơn đã thanh toán
    await client.query(
      `
      UPDATE topup_orders
      SET
        status = 'paid',
        paid_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      `,
      [topup.id]
    );

    await client.query("COMMIT");

    console.log(
      `PAYOS PAID: order=${orderCode}, user=${topup.user_id}, amount=${topup.amount}`
    );

    return res.json({
      message: "Thanh toán đã được xử lý"
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("PayOS webhook error:", error);

    return res.status(500).json({
      message: "Webhook xử lý thất bại"
    });
  } finally {
    client.release();
  }
});


/*
 * Xem trạng thái thanh toán từ PayOS
 */
router.get("/payment/:orderCode", requireAuth, async (req, res) => {
  try {
    const orderCode = Number(req.params.orderCode);

    if (!orderCode) {
      return res.status(400).json({
        message: "Order code không hợp lệ"
      });
    }

    const result = await payos.paymentRequests.get(orderCode);

    res.json(result);
  } catch (error) {
    console.error("Get PayOS payment error:", error);

    res.status(500).json({
      message: "Không thể lấy trạng thái thanh toán"
    });
  }
});


/*
 * Xác nhận webhook URL với PayOS
 * Chỉ admin được sử dụng.
 */
router.post(
  "/setup-webhook",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const webhookUrl = process.env.PAYOS_WEBHOOK_URL;

      if (!webhookUrl) {
        return res.status(400).json({
          message: "PAYOS_WEBHOOK_URL chưa được cấu hình"
        });
      }

      const result = await payos.webhooks.confirm(webhookUrl);

      res.json({
        message: "Webhook PayOS đã được cấu hình",
        result
      });
    } catch (error) {
      console.error("Setup PayOS webhook error:", error);

      res.status(500).json({
        message: "Không thể cấu hình webhook PayOS",
        error: error.message
      });
    }
  }
);

export default router;
