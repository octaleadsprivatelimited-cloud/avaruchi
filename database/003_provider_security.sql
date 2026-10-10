-- Durable guards and provider outcomes. No credentials are stored in these tables.
CREATE TABLE IF NOT EXISTS rate_limits (
 id VARCHAR(160) PRIMARY KEY, attempts INT NOT NULL DEFAULT 0, expires BIGINT NOT NULL,
 INDEX rate_expiry(expires)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS provider_operations (
 id VARCHAR(180) PRIMARY KEY, order_id VARCHAR(100) NOT NULL, kind VARCHAR(40) NOT NULL,
 status VARCHAR(30) NOT NULL, payload LONGTEXT NOT NULL, data LONGTEXT NOT NULL, updated BIGINT NOT NULL,
 INDEX provider_order(order_id), FOREIGN KEY(order_id) REFERENCES orders(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS invoice_jobs (
 order_id VARCHAR(100) PRIMARY KEY, status VARCHAR(30) NOT NULL, payload LONGTEXT NOT NULL,
 attempts INT NOT NULL DEFAULT 0, first_attempt BIGINT NOT NULL DEFAULT 0,
 next_attempt BIGINT NOT NULL DEFAULT 0, lease VARCHAR(150) NOT NULL DEFAULT '', updated BIGINT NOT NULL,
 INDEX invoice_due(status,next_attempt), FOREIGN KEY(order_id) REFERENCES orders(id)
) ENGINE=InnoDB;
