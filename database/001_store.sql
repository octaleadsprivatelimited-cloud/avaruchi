-- Import into an empty Hostinger MySQL database, or run npm run db:migrate.
-- Durable store data uses InnoDB transactions. No data is held in application files.
CREATE TABLE IF NOT EXISTS products (
 id VARCHAR(100) PRIMARY KEY, data LONGTEXT NOT NULL, active TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS variants (
 id VARCHAR(120) PRIMARY KEY, product_id VARCHAR(100) NOT NULL,
 weight INT NOT NULL, price INT NOT NULL, stock INT NOT NULL,
 FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS users (
 id VARCHAR(150) PRIMARY KEY, email VARCHAR(320), name VARCHAR(180) NOT NULL, kind VARCHAR(20) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sessions (
 id VARCHAR(150) PRIMARY KEY, user_id VARCHAR(150) NOT NULL, expires BIGINT NOT NULL,
 INDEX sessions_expiry (expires), FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS oauth_states (
 id VARCHAR(150) PRIMARY KEY, verifier VARCHAR(150) NOT NULL, expires BIGINT NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS saved_data (
 user_id VARCHAR(150) PRIMARY KEY, data LONGTEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS coupons (
 code VARCHAR(30) PRIMARY KEY, percent INT NOT NULL, minimum INT NOT NULL, active TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS orders (
 id VARCHAR(100) PRIMARY KEY, user_id VARCHAR(150) NOT NULL, idempotency VARCHAR(100) NOT NULL,
 status VARCHAR(20) NOT NULL, payment VARCHAR(20) NOT NULL, payment_id VARCHAR(150), razorpay_id VARCHAR(150),
 data LONGTEXT NOT NULL, total INT NOT NULL, created BIGINT NOT NULL, tracking VARCHAR(180), email_sent TINYINT NOT NULL DEFAULT 0,
 UNIQUE KEY orders_idempotency (user_id,idempotency), INDEX orders_user_created (user_id,created),
 FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_items (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(100) NOT NULL, variant_id VARCHAR(120) NOT NULL, quantity INT NOT NULL,
 INDEX items_order (order_id), FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (variant_id) REFERENCES variants(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS invoices (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(100) NOT NULL UNIQUE, created BIGINT NOT NULL,
 FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB;
