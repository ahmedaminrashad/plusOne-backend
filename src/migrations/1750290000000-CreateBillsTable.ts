import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBillsTable1750290000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`bills\` (
        \`id\`             VARCHAR(36)    NOT NULL,
        \`groupId\`        VARCHAR(36)    NOT NULL,
        \`title\`          VARCHAR(255)   NOT NULL,
        \`amount\`         DECIMAL(10,2)  NOT NULL,
        \`currency\`       VARCHAR(10)    NOT NULL DEFAULT 'EGP',
        \`paidByUserId\`   VARCHAR(36)    NOT NULL,
        \`notes\`          TEXT           NULL,
        \`receiptPhotoUrl\` VARCHAR(500)  NULL,
        \`createdAt\`      DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`      DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_bills_groupId\` (\`groupId\`),
        INDEX \`IDX_bills_paidByUserId\` (\`paidByUserId\`),
        CONSTRAINT \`FK_bills_groupId\`
          FOREIGN KEY (\`groupId\`) REFERENCES \`groups\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_bills_paidByUserId\`
          FOREIGN KEY (\`paidByUserId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `bills`');
  }
}
