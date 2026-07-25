import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFriendsTable1757000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`friends\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`ownerUserId\` VARCHAR(36) NOT NULL,
        \`friendUserId\` VARCHAR(36) NULL,
        \`pendingPhone\` VARCHAR(255) NULL,
        \`displayName\` VARCHAR(255) NULL,
        \`status\` ENUM('active','pending') NOT NULL DEFAULT 'active',
        \`createdAt\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_friends_ownerUserId_friendUserId\` (\`ownerUserId\`, \`friendUserId\`),
        UNIQUE KEY \`UQ_friends_ownerUserId_pendingPhone\` (\`ownerUserId\`, \`pendingPhone\`),
        INDEX \`IDX_friends_ownerUserId\` (\`ownerUserId\`),
        INDEX \`IDX_friends_friendUserId\` (\`friendUserId\`),
        CONSTRAINT \`FK_friends_ownerUserId\` FOREIGN KEY (\`ownerUserId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_friends_friendUserId\` FOREIGN KEY (\`friendUserId\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`friends\``);
  }
}
