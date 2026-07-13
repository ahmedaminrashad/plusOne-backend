import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillClosedAt1753000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`bills\` ADD \`closedAt\` DATETIME(6) NULL DEFAULT NULL AFTER \`tipType\``,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`bills\` DROP COLUMN \`closedAt\``);
  }
}
