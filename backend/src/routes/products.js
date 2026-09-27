import express from "express";
import { pool } from "../db/pool.js";
import {
  requireAuth,
  requireAdmin
} from "../middleware/auth.js";

const router = express.Router();


// =====================================================
// GET ALL PRODUCTS
// Public
// =====================================================

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.image_url,
        p.category,
        p.price,
        p.stock,
        p.is_active,
        p.created_at,
        p.updated_at
      FROM products p
      WHERE p.is_active = true
      ORDER BY p.created_at DESC
    `);

    res.json({
      products: result.rows
    });

  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);

    res.status(500).json({
      message: "Không thể lấy danh sách game"
    });
  }
});


// =====================================================
// GET PRODUCT BY ID
// Public
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId)) {
      return res.status(400).json({
        message: "ID game không hợp lệ"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        slug,
        description,
        image_url,
        category,
        price,
        stock,
        is_active,
        created_at,
        updated_at
      FROM products
      WHERE id = $1
      LIMIT 1
      `,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy game"
      });
    }

    res.json({
      product: result.rows[0]
    });

  } catch (error) {
    console.error("GET PRODUCT ERROR:", error);

    res.status(500).json({
      message: "Không thể lấy thông tin game"
    });
  }
});


// =====================================================
// CREATE PRODUCT
// Admin only
// =====================================================

router.post(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res) => {

    try {
      const {
        name,
        slug,
        description,
        image_url,
        category,
        price
      } = req.body;

      if (!name || !slug || price === undefined) {
        return res.status(400).json({
          message: "Tên game, slug và giá là bắt buộc"
        });
      }

      const numericPrice = Number(price);

      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        return res.status(400).json({
          message: "Giá game không hợp lệ"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO products
          (
            name,
            slug,
            description,
            image_url,
            category,
            price,
            stock,
            is_active
          )
        VALUES
          ($1, $2, $3, $4, $5, $6, 0, true)
        RETURNING
          id,
          name,
          slug,
          description,
          image_url,
          category,
          price,
          stock,
          is_active,
          created_at,
          updated_at
        `,
        [
          name.trim(),
          slug.trim(),
          description || null,
          image_url || null,
          category || null,
          numericPrice
        ]
      );

      res.status(201).json({
        message: "Thêm game thành công",
        product: result.rows[0]
      });

    } catch (error) {
      console.error("CREATE PRODUCT ERROR:", error);

      if (error.code === "23505") {
        return res.status(409).json({
          message: "Slug game đã tồn tại"
        });
      }

      res.status(500).json({
        message: "Không thể thêm game"
      });
    }
  }
);


// =====================================================
// UPDATE PRODUCT
// Admin only
// =====================================================

router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {

    try {
      const productId = Number(req.params.id);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          message: "ID game không hợp lệ"
        });
      }

      const {
        name,
        slug,
        description,
        image_url,
        category,
        price,
        is_active
      } = req.body;

      if (!name || !slug || price === undefined) {
        return res.status(400).json({
          message: "Tên game, slug và giá là bắt buộc"
        });
      }

      const numericPrice = Number(price);

      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        return res.status(400).json({
          message: "Giá game không hợp lệ"
        });
      }

      const result = await pool.query(
        `
        UPDATE products
        SET
          name = $1,
          slug = $2,
          description = $3,
          image_url = $4,
          category = $5,
          price = $6,
          is_active = $7
        WHERE id = $8
        RETURNING
          id,
          name,
          slug,
          description,
          image_url,
          category,
          price,
          stock,
          is_active,
          created_at,
          updated_at
        `,
        [
          name.trim(),
          slug.trim(),
          description || null,
          image_url || null,
          category || null,
          numericPrice,
          is_active !== false,
          productId
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Không tìm thấy game"
        });
      }

      res.json({
        message: "Cập nhật game thành công",
        product: result.rows[0]
      });

    } catch (error) {
      console.error("UPDATE PRODUCT ERROR:", error);

      if (error.code === "23505") {
        return res.status(409).json({
          message: "Slug game đã tồn tại"
        });
      }

      res.status(500).json({
        message: "Không thể cập nhật game"
      });
    }
  }
);


// =====================================================
// DELETE PRODUCT
// Admin only
// =====================================================

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {

    const client = await pool.connect();

    try {
      const productId = Number(req.params.id);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          message: "ID game không hợp lệ"
        });
      }

      await client.query("BEGIN");

      // Không cho xóa nếu đã có key được bán.
      const soldKeys = await client.query(
        `
        SELECT id
        FROM game_keys
        WHERE product_id = $1
          AND status <> 'available'
        LIMIT 1
        `,
        [productId]
      );

      if (soldKeys.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          message:
            "Không thể xóa game vì game đã có key được bán. Hãy tắt is_active thay vì xóa."
        });
      }

      await client.query(
        `
        DELETE FROM game_keys
        WHERE product_id = $1
        `,
        [productId]
      );

      const result = await client.query(
        `
        DELETE FROM products
        WHERE id = $1
        RETURNING id, name
        `,
        [productId]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Không tìm thấy game"
        });
      }

      await client.query("COMMIT");

      res.json({
        message: "Xóa game thành công",
        product: result.rows[0]
      });

    } catch (error) {
      await client.query("ROLLBACK");

      console.error("DELETE PRODUCT ERROR:", error);

      res.status(500).json({
        message: "Không thể xóa game"
      });

    } finally {
      client.release();
    }
  }
);


// =====================================================
// ADD GAME KEY
// Admin only
// =====================================================

router.post(
  "/:id/keys",
  requireAuth,
  requireAdmin,
  async (req, res) => {

    const client = await pool.connect();

    try {
      const productId = Number(req.params.id);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          message: "ID game không hợp lệ"
        });
      }

      const {
        keys
      } = req.body;

      if (!Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({
          message:
            "keys phải là một mảng chứa ít nhất một game key"
        });
      }

      // Loại bỏ key trống và khoảng trắng.
      const cleanKeys = [
        ...new Set(
          keys
            .map((key) => String(key).trim())
            .filter(Boolean)
        )
      ];

      if (cleanKeys.length === 0) {
        return res.status(400).json({
          message: "Không có game key hợp lệ"
        });
      }

      await client.query("BEGIN");

      const product = await client.query(
        `
        SELECT id
        FROM products
        WHERE id = $1
        FOR UPDATE
        `,
        [productId]
      );

      if (product.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Không tìm thấy game"
        });
      }

      let added = 0;

      for (const key of cleanKeys) {

        const existing = await client.query(
          `
          SELECT id
          FROM game_keys
          WHERE product_id = $1
            AND key_value = $2
          LIMIT 1
          `,
          [productId, key]
        );

        if (existing.rows.length > 0) {
          continue;
        }

        await client.query(
          `
          INSERT INTO game_keys
            (
              product_id,
              key_value,
              status
            )
          VALUES
            ($1, $2, 'available')
          `,
          [productId, key]
        );

        added++;
      }

      // Cập nhật stock theo số key available thực tế.
      await client.query(
        `
        UPDATE products
        SET stock = (
          SELECT COUNT(*)
          FROM game_keys
          WHERE product_id = $1
            AND status = 'available'
        )
        WHERE id = $1
        `,
        [productId]
      );

      await client.query("COMMIT");

      res.status(201).json({
        message: "Thêm game key thành công",
        received: cleanKeys.length,
        added,
        skipped: cleanKeys.length - added
      });

    } catch (error) {
      await client.query("ROLLBACK");

      console.error("ADD GAME KEYS ERROR:", error);

      res.status(500).json({
        message: "Không thể thêm game key"
      });

    } finally {
      client.release();
    }
  }
);


// =====================================================
// GET GAME KEYS
// Admin only
// =====================================================

router.get(
  "/:id/keys",
  requireAuth,
  requireAdmin,
  async (req, res) => {

    try {
      const productId = Number(req.params.id);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          message: "ID game không hợp lệ"
        });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          product_id,
          key_value,
          status,
          order_id,
          sold_to_user_id,
          sold_at,
          created_at
        FROM game_keys
        WHERE product_id = $1
        ORDER BY created_at DESC
        `,
        [productId]
      );

      res.json({
        keys: result.rows
      });

    } catch (error) {
      console.error("GET GAME KEYS ERROR:", error);

      res.status(500).json({
        message: "Không thể lấy danh sách game key"
      });
    }
  }
);


// =====================================================
// DELETE GAME KEY
// Admin only
// =====================================================

router.delete(
  "/keys/:keyId",
  requireAuth,
  requireAdmin,
  async (req, res) => {

    const client = await pool.connect();

    try {
      const keyId = Number(req.params.keyId);

      if (!Number.isInteger(keyId)) {
        return res.status(400).json({
          message: "ID game key không hợp lệ"
        });
      }

      await client.query("BEGIN");

      const keyResult = await client.query(
        `
        SELECT
          id,
          product_id,
          status
        FROM game_keys
        WHERE id = $1
        FOR UPDATE
        `,
        [keyId]
      );

      if (keyResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Không tìm thấy game key"
        });
      }

      const key = keyResult.rows[0];

      // Không cho xóa key đã bán.
      if (key.status !== "available") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          message:
            "Không thể xóa game key đã bán"
        });
      }

      await client.query(
        `
        DELETE FROM game_keys
        WHERE id = $1
        `,
        [keyId]
      );

      await client.query(
        `
        UPDATE products
        SET stock = (
          SELECT COUNT(*)
          FROM game_keys
          WHERE product_id = $1
            AND status = 'available'
        )
        WHERE id = $1
        `,
        [key.product_id]
      );

      await client.query("COMMIT");

      res.json({
        message: "Xóa game key thành công"
      });

    } catch (error) {
      await client.query("ROLLBACK");

      console.error("DELETE GAME KEY ERROR:", error);

      res.status(500).json({
        message: "Không thể xóa game key"
      });

    } finally {
      client.release();
    }
  }
);
// =====================================================
// GET ACTIVE FOLDERS
// Public
// =====================================================

router.get("/folders/list", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pf.id,
        pf.name,
        pf.button_text,
        pf.description,
        pf.image_url,
        pf.sort_order,
        pf.is_active,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'slug', p.slug,
              'description', p.description,
              'image_url', p.image_url,
              'category', p.category,
              'price', p.price,
              'stock', p.stock,
              'is_active', p.is_active
            )
            ORDER BY pfi.sort_order ASC, p.id ASC
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS products
      FROM product_folders pf
      LEFT JOIN product_folder_items pfi
        ON pfi.folder_id = pf.id
      LEFT JOIN products p
        ON p.id = pfi.product_id
       AND p.is_active = true
      WHERE pf.is_active = true
      GROUP BY
        pf.id,
        pf.name,
        pf.button_text,
        pf.description,
        pf.image_url,
        pf.sort_order,
        pf.is_active
      ORDER BY
        pf.sort_order ASC,
        pf.id ASC
    `);

    return res.json({
      folders: result.rows
    });

  } catch (error) {

    console.error(
      "GET FOLDERS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy danh sách Folder"
    });
  }
});

export default router;
