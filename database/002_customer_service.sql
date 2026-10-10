-- Adds manual shipments and customer-owned return/refund cases without replacing orders.
CREATE TABLE IF NOT EXISTS order_shipments (
 order_id VARCHAR(100) PRIMARY KEY, courier VARCHAR(100) NOT NULL DEFAULT '',
 tracking_url VARCHAR(500) NOT NULL DEFAULT '', eta VARCHAR(10) NOT NULL DEFAULT '',
 provider VARCHAR(30) NOT NULL DEFAULT 'manual', version INT NOT NULL DEFAULT 0, updated BIGINT NOT NULL,
 FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS service_requests (
 id VARCHAR(100) PRIMARY KEY, order_id VARCHAR(100) NOT NULL UNIQUE, user_id VARCHAR(150) NOT NULL,
 kind VARCHAR(20) NOT NULL, reason VARCHAR(30) NOT NULL, details TEXT NOT NULL, status VARCHAR(30) NOT NULL,
 refund_amount INT NOT NULL DEFAULT 0, refund_reference VARCHAR(180) NOT NULL DEFAULT '', history LONGTEXT NOT NULL,
 version INT NOT NULL DEFAULT 1, created BIGINT NOT NULL, updated BIGINT NOT NULL,
 INDEX requests_user_created (user_id,created),
 FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
