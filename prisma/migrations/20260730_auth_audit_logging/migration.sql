-- Secure application authentication and audit trail.
-- Apply with: npx prisma migrate deploy

CREATE TABLE `app_users` (
  `id` CHAR(36) NOT NULL,
  `username` VARCHAR(64) NOT NULL,
  `display_name` VARCHAR(120) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'OPERATOR',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `must_change_password` BOOLEAN NOT NULL DEFAULT TRUE,
  `failed_login_count` INTEGER NOT NULL DEFAULT 0,
  `locked_until` DATETIME(3) NULL,
  `password_changed_at` DATETIME(3) NULL,
  `last_login_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `uq_app_users_username` (`username`),
  INDEX `idx_app_users_active` (`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auth_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(512) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `uq_auth_sessions_token_hash` (`token_hash`),
  INDEX `idx_auth_sessions_user_status` (`user_id`, `revoked_at`, `expires_at`),
  INDEX `idx_auth_sessions_expiry` (`expires_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_auth_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `user_id` CHAR(36) NULL,
  `username` VARCHAR(64) NULL,
  `event_type` VARCHAR(64) NOT NULL,
  `outcome` VARCHAR(20) NOT NULL,
  `action` VARCHAR(120) NOT NULL,
  `resource` VARCHAR(255) NULL,
  `request_id` VARCHAR(64) NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(512) NULL,
  `details` JSON NULL,

  INDEX `idx_audit_logs_occurred` (`occurred_at`),
  INDEX `idx_audit_logs_user_occurred` (`user_id`, `occurred_at`),
  INDEX `idx_audit_logs_event_occurred` (`event_type`, `occurred_at`),
  INDEX `idx_audit_logs_outcome_occurred` (`outcome`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `login_attempts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `ip_address` VARCHAR(64) NOT NULL,
  `was_successful` BOOLEAN NOT NULL DEFAULT FALSE,
  `attempted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `idx_login_attempts_username_time` (`username`, `attempted_at`),
  INDEX `idx_login_attempts_ip_time` (`ip_address`, `attempted_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
