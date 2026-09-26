-- =========================================================
-- PIXELKEY DATABASE SCHEMA
-- PostgreSQL
-- =========================================================

BEGIN;

-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    username VARCHAR(50) NOT NULL UNIQUE,

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin')),

    balance NUMERIC(14, 2) NOT NULL DEFAULT 0
        CHECK (balance >= 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_created_at
ON users(created_at);


-- =========================================================
-- PRODUCTS / GAMES
-- =========================================================

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    slug VARCHAR(255) NOT NULL UNIQUE,

    description TEXT,

    image_url TEXT,

    category VARCHAR(100),

    price NUMERIC(14, 2) NOT NULL
        CHECK (price >= 0),

    stock INTEGER NOT NULL DEFAULT 0
        CHECK (stock >= 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category
ON products(category);

CREATE INDEX IF NOT EXISTS idx_products_active
ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_products_created_at
ON products(created_at);


-- =========================================================
-- GAME KEYS
-- =========================================================

CREATE TABLE IF NOT EXISTS game_keys (
    id BIGSERIAL PRIMARY KEY,

    product_id BIGINT NOT NULL
        REFERENCES products(id)
        ON DELETE CASCADE,

    key_value TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'sold', 'disabled')),

    order_id BIGINT,

    sold_to_user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    sold_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(product_id, key_value)
);

CREATE INDEX IF NOT EXISTS idx_game_keys_product
ON game_keys(product_id);

CREATE INDEX IF NOT EXISTS idx_game_keys_status
ON game_keys(status);

CREATE INDEX IF NOT EXISTS idx_game_keys_available
ON game_keys(product_id, status);


-- =========================================================
-- COUPONS
-- =========================================================

CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,

    code VARCHAR(50) NOT NULL UNIQUE,

    discount_type VARCHAR(20) NOT NULL
        CHECK (discount_type IN ('percent', 'fixed')),

    discount_value NUMERIC(14, 2) NOT NULL
        CHECK (discount_value >= 0),

    min_order_amount NUMERIC(14, 2) NOT NULL DEFAULT 0
        CHECK (min_order_amount >= 0),

    max_discount NUMERIC(14, 2),

    usage_limit INTEGER,

    used_count INTEGER NOT NULL DEFAULT 0
        CHECK (used_count >= 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    starts_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        max_discount IS NULL
        OR max_discount >= 0
    ),

    CHECK (
        usage_limit IS NULL
        OR usage_limit >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_coupons_code
ON coupons(code);

CREATE INDEX IF NOT EXISTS idx_coupons_active
ON coupons(is_active);


-- =========================================================
-- ORDERS
-- =========================================================

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    order_code VARCHAR(100) NOT NULL UNIQUE,

    subtotal NUMERIC(14, 2) NOT NULL
        CHECK (subtotal >= 0),

    discount NUMERIC(14, 2) NOT NULL DEFAULT 0
        CHECK (discount >= 0),

    total NUMERIC(14, 2) NOT NULL
        CHECK (total >= 0),

    coupon_id BIGINT
        REFERENCES coupons(id)
        ON DELETE SET NULL,

    payment_method VARCHAR(30) NOT NULL DEFAULT 'wallet',

    status VARCHAR(30) NOT NULL DEFAULT 'completed'
        CHECK (
            status IN (
                'pending',
                'paid',
                'completed',
                'cancelled',
                'refunded'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user
ON orders(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
ON orders(created_at);


-- =========================================================
-- ORDER ITEMS
-- =========================================================

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    product_id BIGINT NOT NULL
        REFERENCES products(id)
        ON DELETE RESTRICT,

    product_name VARCHAR(255) NOT NULL,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    unit_price NUMERIC(14, 2) NOT NULL
        CHECK (unit_price >= 0),

    subtotal NUMERIC(14, 2) NOT NULL
        CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
ON order_items(order_id);


-- =========================================================
-- TOPUPS / NẠP TIỀN
-- =========================================================

CREATE TABLE IF NOT EXISTS topups (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    order_code VARCHAR(100) NOT NULL UNIQUE,

    amount NUMERIC(14, 2) NOT NULL
        CHECK (amount > 0),

    payment_method VARCHAR(30) NOT NULL DEFAULT 'payos',

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'paid',
                'cancelled',
                'expired'
            )
        ),

    payos_payment_link_id VARCHAR(255),

    payos_transaction_id VARCHAR(255),

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topups_user
ON topups(user_id);

CREATE INDEX IF NOT EXISTS idx_topups_status
ON topups(status);

CREATE INDEX IF NOT EXISTS idx_topups_order_code
ON topups(order_code);


-- =========================================================
-- WALLET TRANSACTIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    type VARCHAR(30) NOT NULL
        CHECK (
            type IN (
                'topup',
                'purchase',
                'refund',
                'admin_adjustment'
            )
        ),

    amount NUMERIC(14, 2) NOT NULL
        CHECK (amount > 0),

    balance_before NUMERIC(14, 2) NOT NULL
        CHECK (balance_before >= 0),

    balance_after NUMERIC(14, 2) NOT NULL
        CHECK (balance_after >= 0),

    reference_type VARCHAR(50),

    reference_id BIGINT,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user
ON wallet_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created
ON wallet_transactions(created_at);


-- =========================================================
-- CHAT
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    username VARCHAR(50) NOT NULL,

    message TEXT NOT NULL,

    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created
ON chat_messages(created_at);


-- =========================================================
-- PAYOS WEBHOOK EVENTS
-- Dùng để chống cộng tiền 2 lần khi webhook được gửi lại.
-- =========================================================

CREATE TABLE IF NOT EXISTS payos_webhook_events (
    id BIGSERIAL PRIMARY KEY,

    reference_code VARCHAR(255) NOT NULL UNIQUE,

    order_code VARCHAR(100),

    transaction_id VARCHAR(255),

    payload JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payos_events_order_code
ON payos_webhook_events(order_code);


-- =========================================================
-- FOREIGN KEY CHO GAME KEYS -> ORDERS
-- Tạo sau khi orders đã tồn tại.
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_game_keys_order'
    ) THEN

        ALTER TABLE game_keys
        ADD CONSTRAINT fk_game_keys_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE SET NULL;

    END IF;
END $$;


-- =========================================================
-- TRIGGER: UPDATE updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_users_updated_at
ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_products_updated_at
ON products;

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_orders_updated_at
ON orders;

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_topups_updated_at
ON topups;

CREATE TRIGGER trg_topups_updated_at
BEFORE UPDATE ON topups
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


COMMIT;