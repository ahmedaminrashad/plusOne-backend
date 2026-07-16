import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillIdToMessages1755000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`messages\`
      ADD COLUMN \`billId\` VARCHAR(36) NULL DEFAULT NULL AFTER \`imageUrl\`,
      ADD INDEX \`IDX_messages_billId\` (\`billId\`),
      ADD CONSTRAINT \`FK_messages_billId\` FOREIGN KEY (\`billId\`) REFERENCES \`bills\` (\`id\`) ON DELETE CASCADE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`messages\`
      DROP FOREIGN KEY \`FK_messages_billId\`,
      DROP INDEX \`IDX_messages_billId\`,
      DROP COLUMN \`billId\`
    `);
  }
}
