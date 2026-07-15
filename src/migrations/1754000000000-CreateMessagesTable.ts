import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessagesTable1754000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`messages\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`groupId\` VARCHAR(36) NOT NULL,
        \`senderId\` VARCHAR(36) NOT NULL,
        \`text\` TEXT NULL,
        \`imageUrl\` VARCHAR(500) NULL,
        \`createdAt\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_messages_groupId_createdAt\` (\`groupId\`, \`createdAt\`),
        CONSTRAINT \`FK_messages_groupId\` FOREIGN KEY (\`groupId\`) REFERENCES \`groups\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_messages_senderId\` FOREIGN KEY (\`senderId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`messages\``);
  }
}
