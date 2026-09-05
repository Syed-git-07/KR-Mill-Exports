CREATE TABLE `spinning_machine_defaults` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `efficiency` DECIMAL(5, 3) NOT NULL DEFAULT 0.950,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `spinning_machine_defaults` (`id`, `efficiency`) VALUES (1, 0.950);
