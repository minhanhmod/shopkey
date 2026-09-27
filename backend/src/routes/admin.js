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
// =====================================
// QUẢN LÝ FOLDER SẢN PHẨM
// =====================================

// GET /api/admin/folders
router.get("/folders", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        button_text,
        description,
        image_url,
        sort_order,
        is_active,
        created_at,
        updated_at
      FROM product_folders
      ORDER BY sort_order ASC, id ASC
    `);

    return res.json({
      folders: result.rows
    });
  } catch (error) {
    console.error("ADMIN FOLDERS GET ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách folder"
    });
  }
});


// POST /api/admin/folders
router.post("/folders", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const buttonText =
      String(req.body.button_text || "XEM SẢN PHẨM").trim();
    const description =
      String(req.body.description || "").trim();
    const imageUrl =
      String(req.body.image_url || "").trim();

    const sortOrder =
      Number.isInteger(Number(req.body.sort_order))
        ? Number(req.body.sort_order)
        : 0;

    const isActive =
      req.body.is_active !== false;

    if (!name) {
      return res.status(400).json({
        message: "Tên folder không được để trống"
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        message: "Tên folder tối đa 100 ký tự"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO product_folders (
        name,
        button_text,
        description,
        image_url,
        sort_order,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        name,
        buttonText || "XEM SẢN PHẨM",
        description || null,
        imageUrl || null,
        sortOrder,
        isActive
      ]
    );

    return res.status(201).json({
      message: "Tạo folder thành công",
      folder: result.rows[0]
    });
  } catch (error) {
    console.error("ADMIN FOLDER CREATE ERROR:", error);

    return res.status(500).json({
      message: "Không thể tạo folder"
    });
  }
});


// PUT /api/admin/folders/:id
router.put("/folders/:id", async (req, res) => {
  try {
    const folderId = Number(req.params.id);

    if (!Number.isInteger(folderId) || folderId <= 0) {
      return res.status(400).json({
        message: "Folder ID không hợp lệ"
      });
    }

    const name = String(req.body.name || "").trim();
    const buttonText =
      String(req.body.button_text || "XEM SẢN PHẨM").trim();
    const description =
      String(req.body.description || "").trim();
    const imageUrl =
      String(req.body.image_url || "").trim();

    const sortOrder =
      Number.isInteger(Number(req.body.sort_order))
        ? Number(req.body.sort_order)
        : 0;

    const isActive =
      req.body.is_active !== false;

    if (!name) {
      return res.status(400).json({
        message: "Tên folder không được để trống"
      });
    }

    const result = await pool.query(
      `
      UPDATE product_folders
      SET
        name = $1,
        button_text = $2,
        description = $3,
        image_url = $4,
        sort_order = $5,
        is_active = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
      `,
      [
        name,
        buttonText || "XEM SẢN PHẨM",
        description || null,
        imageUrl || null,
        sortOrder,
        isActive,
        folderId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy folder"
      });
    }

    return res.json({
      message: "Cập nhật folder thành công",
      folder: result.rows[0]
    });
  } catch (error) {
    console.error("ADMIN FOLDER UPDATE ERROR:", error);

    return res.status(500).json({
      message: "Không thể cập nhật folder"
    });
  }
});


// DELETE /api/admin/folders/:id
router.delete("/folders/:id", async (req, res) => {
  try {
    const folderId = Number(req.params.id);

    if (!Number.isInteger(folderId) || folderId <= 0) {
      return res.status(400).json({
        message: "Folder ID không hợp lệ"
      });
    }

    const result = await pool.query(
      `
      DELETE FROM product_folders
      WHERE id = $1
      RETURNING id, name
      `,
      [folderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy folder"
      });
    }

    return res.json({
      message: "Xóa folder thành công",
      folder: result.rows[0]
    });
  } catch (error) {
    console.error("ADMIN FOLDER DELETE ERROR:", error);

    return res.status(500).json({
      message: "Không thể xóa folder"
    });
  }
});


// PUT /api/admin/folders/:id/products
// Gán danh sách sản phẩm vào folder
router.put("/folders/:id/products", async (req, res) => {
  const client = await pool.connect();

  try {
    const folderId = Number(req.params.id);

    if (!Number.isInteger(folderId) || folderId <= 0) {
      return res.status(400).json({
        message: "Folder ID không hợp lệ"
      });
    }

    const productIds = Array.isArray(req.body.product_ids)
      ? req.body.product_ids
          .map(Number)
          .filter(
            id => Number.isInteger(id) && id > 0
          )
      : [];

    const folderCheck = await client.query(
      `
      SELECT id
      FROM product_folders
      WHERE id = $1
      `,
      [folderId]
    );

    if (folderCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy folder"
      });
    }

    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM product_folder_items
      WHERE folder_id = $1
      `,
      [folderId]
    );

    for (let i = 0; i < productIds.length; i++) {
      await client.query(
        `
        INSERT INTO product_folder_items (
          folder_id,
          product_id,
          sort_order
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (folder_id, product_id)
        DO UPDATE SET sort_order = EXCLUDED.sort_order
        `,
        [
          folderId,
          productIds[i],
          i
        ]
      );
    }

    await client.query("COMMIT");

    return res.json({
      message: "Cập nhật sản phẩm trong folder thành công",
      folder_id: folderId,
      product_ids: productIds
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "ADMIN FOLDER PRODUCTS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể cập nhật sản phẩm trong folder"
    });
  } finally {
    client.release();
  }
});
// =====================================
// FOLDER - GÁN SẢN PHẨM
// =====================================

// Lấy danh sách sản phẩm trong một folder
router.get("/folders/:id/products", async (req, res) => {
  try {
    const folderId = Number(req.params.id);

    if (!Number.isInteger(folderId) || folderId <= 0) {
      return res.status(400).json({
        message: "Folder ID không hợp lệ"
      });
    }

    const result = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.category,
        p.price,
        p.stock,
        p.image_url,
        p.description,
        p.is_active,
        pfi.sort_order
      FROM product_folder_items pfi
      JOIN products p
        ON p.id = pfi.product_id
      WHERE pfi.folder_id = $1
      ORDER BY pfi.sort_order ASC, p.id ASC
      `,
      [folderId]
    );

    return res.json({
      products: result.rows
    });

  } catch (error) {
    console.error(
      "ADMIN FOLDER PRODUCTS GET ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy sản phẩm trong folder"
    });
  }
});


// Gán danh sách sản phẩm vào folder
router.put("/folders/:id/products", async (req, res) => {
  const client = await pool.connect();

  try {
    const folderId = Number(req.params.id);

    if (!Number.isInteger(folderId) || folderId <= 0) {
      return res.status(400).json({
        message: "Folder ID không hợp lệ"
      });
    }

    const productIds = Array.isArray(req.body.product_ids)
      ? req.body.product_ids
          .map(Number)
          .filter(
            id => Number.isInteger(id) && id > 0
          )
      : [];

    const folderCheck = await client.query(
      `
      SELECT id
      FROM product_folders
      WHERE id = $1
      `,
      [folderId]
    );

    if (folderCheck.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy folder"
      });
    }

    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM product_folder_items
      WHERE folder_id = $1
      `,
      [folderId]
    );

    for (let i = 0; i < productIds.length; i++) {
      await client.query(
        `
        INSERT INTO product_folder_items (
          folder_id,
          product_id,
          sort_order
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (folder_id, product_id)
        DO UPDATE SET
          sort_order = EXCLUDED.sort_order
        `,
        [
          folderId,
          productIds[i],
          i
        ]
      );
    }

    await client.query("COMMIT");

    return res.json({
      message: "Đã cập nhật sản phẩm trong folder",
      folder_id: folderId,
      product_ids: productIds
    });

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(
      "ADMIN FOLDER PRODUCTS UPDATE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể cập nhật sản phẩm trong folder"
    });

  } finally {
    client.release();
  }
});
export default router;
