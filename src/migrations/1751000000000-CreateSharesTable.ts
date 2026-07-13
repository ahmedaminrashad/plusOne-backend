import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSharesTable1751000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`shares\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`billId\` VARCHAR(36) NOT NULL,
        \`groupId\` VARCHAR(36) NOT NULL,
        \`initiatorUserId\` VARCHAR(36) NOT NULL,
        \`ownerUserId\` VARCHAR(36) NULL,
        \`ownerPendingPhone\` VARCHAR(255) NULL,
        \`amountPiastres\` INT NOT NULL,
        \`currency\` VARCHAR(10) NOT NULL DEFAULT 'EGP',
        \`status\` ENUM('pending','initiated','settled','cancelled','failed') NOT NULL DEFAULT 'pending',
        \`method\` ENUM('instapay','card') NOT NULL DEFAULT 'instapay',
        \`reference\` VARCHAR(40) NULL,
        \`failureReason\` ENUM('payment_not_received','member_cancelled','wrong_amount','confirmed_by_mistake','other') NULL,
        \`initiatedAt\` DATETIME(6) NULL,
        \`lastReminderSentAt\` DATETIME(6) NULL,
        \`createdAt\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_shares_billId_ownerUserId\` (\`billId\`, \`ownerUserId\`),
        UNIQUE KEY \`UQ_shares_billId_ownerPendingPhone\` (\`billId\`, \`ownerPendingPhone\`),
        INDEX \`IDX_shares_billId\` (\`billId\`),
        INDEX \`IDX_shares_groupId\` (\`groupId\`),
        INDEX \`IDX_shares_initiatorUserId\` (\`initiatorUserId\`),
        INDEX \`IDX_shares_ownerUserId\` (\`ownerUserId\`),
        CONSTRAINT \`FK_shares_billId\` FOREIGN KEY (\`billId\`) REFERENCES \`bills\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_shares_groupId\` FOREIGN KEY (\`groupId\`) REFERENCES \`groups\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_shares_initiatorUserId\` FOREIGN KEY (\`initiatorUserId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_shares_ownerUserId\` FOREIGN KEY (\`ownerUserId\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`shares\``);
  }
}
