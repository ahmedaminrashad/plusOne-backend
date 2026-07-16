-- PlusOne Database Schema (MySQL)
-- Last updated: 2026-07-16 (messages.billId — receipts shared into group chat)
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
  `fcmToken`          VARCHAR(255)  NULL,
  `language`          ENUM('ar','en') NOT NULL DEFAULT 'ar',
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


CREATE TABLE `bills` (
  `id`              VARCHAR(36)                        NOT NULL,
  `groupId`         VARCHAR(36)                        NOT NULL,
  `title`           VARCHAR(255)                       NULL DEFAULT NULL,
  `amount`          DECIMAL(10,2)                      NOT NULL,
  `currency`        VARCHAR(10)                        NOT NULL DEFAULT 'EGP',
  `paidByUserId`    VARCHAR(36)                        NOT NULL,
  `notes`           TEXT                               NULL,
  `receiptPhotoUrl` VARCHAR(500)                       NULL,
  `captureMethod`   ENUM('qr','manual','ocr')          NOT NULL DEFAULT 'manual',
  `sourceRef`       VARCHAR(500)                       NULL,
  `venueName`       VARCHAR(255)                       NULL,
  `lineItems`       JSON                               NULL, -- [{name, qty, unitPrice, claimedBy: groupMemberId[]}]. Editable via PATCH /bills/:id/items while closedAt IS NULL.
  `tax`             DECIMAL(10,2)                      NULL,
  `taxType`         ENUM('percent','amount')           NULL,
  `service`         DECIMAL(10,2)                      NULL,
  `serviceType`     ENUM('percent','amount')           NULL,
  `tip`             DECIMAL(10,2)                      NULL,
  `tipType`         ENUM('percent','amount')           NULL,
  `closedAt`        DATETIME(6)                        NULL DEFAULT NULL,
  `createdAt`       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `IDX_bills_groupId` (`groupId`),
  INDEX `IDX_bills_paidByUserId` (`paidByUserId`),
  CONSTRAINT `FK_bills_groupId`
    FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_bills_paidByUserId`
    FOREIGN KEY (`paidByUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `shares` (
  `id`                  VARCHAR(36)                                                              NOT NULL,
  `billId`               VARCHAR(36)                                                              NOT NULL,
  `groupId`              VARCHAR(36)                                                              NOT NULL,
  `initiatorUserId`      VARCHAR(36)                                                              NOT NULL,
  `ownerUserId`          VARCHAR(36)                                                              NULL,
  `ownerPendingPhone`    VARCHAR(255)                                                             NULL,
  `amountPiastres`       INT                                                                      NOT NULL,
  `currency`             VARCHAR(10)                                                              NOT NULL DEFAULT 'EGP',
  `status`               ENUM('pending','initiated','settled','cancelled','failed')                NOT NULL DEFAULT 'pending',
  `method`               ENUM('instapay','card')                                                  NOT NULL DEFAULT 'instapay',
  `reference`            VARCHAR(40)                                                              NULL,
  `failureReason`        ENUM('payment_not_received','member_cancelled','wrong_amount','confirmed_by_mistake','other') NULL,
  `initiatedAt`          DATETIME(6)                                                              NULL,
  `lastReminderSentAt`   DATETIME(6)                                                              NULL,
  `createdAt`            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_shares_billId_ownerUserId`       (`billId`, `ownerUserId`),
  UNIQUE KEY `UQ_shares_billId_ownerPendingPhone` (`billId`, `ownerPendingPhone`),
  INDEX `IDX_shares_billId` (`billId`),
  INDEX `IDX_shares_groupId` (`groupId`),
  INDEX `IDX_shares_initiatorUserId` (`initiatorUserId`),
  INDEX `IDX_shares_ownerUserId` (`ownerUserId`),
  CONSTRAINT `FK_shares_billId`
    FOREIGN KEY (`billId`) REFERENCES `bills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_shares_groupId`
    FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_shares_initiatorUserId`
    FOREIGN KEY (`initiatorUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_shares_ownerUserId`
    FOREIGN KEY (`ownerUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `messages` (
  `id`        VARCHAR(36)   NOT NULL,
  `groupId`   VARCHAR(36)   NOT NULL,
  `senderId`  VARCHAR(36)   NOT NULL,
  `text`      TEXT          NULL,
  `imageUrl`  VARCHAR(500)  NULL,
  `billId`    VARCHAR(36)   NULL DEFAULT NULL, -- set when a member shares a receipt into the group chat; message renders as a receipt card
  `createdAt` DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `IDX_messages_groupId_createdAt` (`groupId`, `createdAt`),
  INDEX `IDX_messages_billId` (`billId`),
  CONSTRAINT `FK_messages_groupId`
    FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_messages_senderId`
    FOREIGN KEY (`senderId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_messages_billId`
    FOREIGN KEY (`billId`) REFERENCES `bills` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `audit_log` (
  `id`         VARCHAR(36)                                          NOT NULL,
  `shareId`    VARCHAR(36)                                          NOT NULL,
  `fromState`  VARCHAR(20)                                          NULL,
  `toState`    VARCHAR(20)                                          NOT NULL,
  `actor`      VARCHAR(36)                                          NULL,
  `source`     ENUM('user','webhook','reminder-job','system')       NOT NULL,
  `reason`     VARCHAR(255)                                         NULL,
  `metadata`   JSON                                                 NULL,
  `createdAt`  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `IDX_audit_log_shareId` (`shareId`),
  CONSTRAINT `FK_audit_log_shareId`
    FOREIGN KEY (`shareId`) REFERENCES `shares` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
