-- PlusOne Database Schema (MySQL)
-- Last updated: 2026-06-19
-- Source of truth: sync this file on every entity change.

CREATE TABLE `users` (
  `id`                VARCHAR(36)   NOT NULL,
  `phone`             VARCHAR(255)  NOT NULL UNIQUE,
  `displayName`       VARCHAR(255)  NULL,
  `photoUrl`          VARCHAR(255)  NULL,
  `instaPayAlias`     VARCHAR(255)  NULL,
  `googleId`          VARCHAR(255)  NULL,
  `appleId`           VARCHAR(255)  NULL,
  `email`             VARCHAR(255)  NULL,
  `isProfileComplete` TINYINT(1)    NOT NULL DEFAULT 0,
  `createdAt`         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `otp_codes` (
  `id`          VARCHAR(36)   NOT NULL,
  `phone`       VARCHAR(255)  NOT NULL,
  `code`        VARCHAR(255)  NOT NULL,
  `expiresAt`   DATETIME      NOT NULL,
  `attempts`    INT           NOT NULL DEFAULT 0,
  `lockedUntil` DATETIME      NULL,
  `used`        TINYINT(1)    NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `IDX_otp_codes_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `refresh_tokens` (
  `id`        VARCHAR(36)   NOT NULL,
  `token`     VARCHAR(255)  NOT NULL,
  `userId`    VARCHAR(36)   NOT NULL,
  `expiresAt` DATETIME      NOT NULL,
  `revoked`   TINYINT(1)    NOT NULL DEFAULT 0,
  `createdAt` DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `IDX_refresh_tokens_token` (`token`),
  CONSTRAINT `FK_refresh_tokens_userId`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `groups` (
  `id`        VARCHAR(36)                                       NOT NULL,
  `name`      VARCHAR(255)                                      NOT NULL,
  `category`  ENUM('friends','family','work','travel','other')  NULL,
  `avatarUrl` VARCHAR(255)                                      NULL,
  `createdAt` DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `group_members` (
  `id`           VARCHAR(36)                         NOT NULL,
  `groupId`      VARCHAR(36)                         NOT NULL,
  `userId`       VARCHAR(36)                         NULL,
  `pendingPhone` VARCHAR(255)                        NULL,
  `role`         ENUM('admin','member')              NOT NULL DEFAULT 'member',
  `status`       ENUM('active','pending','removed')  NOT NULL DEFAULT 'active',
  `removedBy`    VARCHAR(255)                        NULL,
  `createdAt`    DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_group_members_groupId_userId`       (`groupId`, `userId`),
  UNIQUE KEY `UQ_group_members_groupId_pendingPhone` (`groupId`, `pendingPhone`),
  CONSTRAINT `FK_group_members_groupId`
    FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_group_members_userId`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
