import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceBillsTable1750900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`bills\`
        MODIFY COLUMN \`title\` VARCHAR(255) NULL DEFAULT NULL,
        ADD COLUMN \`captureMethod\` ENUM('qr','manual','ocr') NOT NULL DEFAULT 'manual' AFTER \`receiptPhotoUrl\`,
        ADD COLUMN \`sourceRef\` VARCHAR(500) NULL AFTER \`captureMethod\`,
        ADD COLUMN \`venueName\` VARCHAR(255) NULL AFTER \`sourceRef\`,
        ADD COLUMN \`lineItems\` JSON NULL AFTER \`venueName\`,
        ADD COLUMN \`tax\` DECIMAL(10,2) NULL AFTER \`lineItems\`,
        ADD COLUMN \`taxType\` ENUM('percent','amount') NULL AFTER \`tax\`,
        ADD COLUMN \`service\` DECIMAL(10,2) NULL AFTER \`taxType\`,
        ADD COLUMN \`serviceType\` ENUM('percent','amount') NULL AFTER \`service\`,
        ADD COLUMN \`tip\` DECIMAL(10,2) NULL AFTER \`serviceType\`,
        ADD COLUMN \`tipType\` ENUM('percent','amount') NULL AFTER \`tip\`
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`bills\`
        MODIFY COLUMN \`title\` VARCHAR(255) NOT NULL,
        DROP COLUMN \`captureMethod\`,
        DROP COLUMN \`sourceRef\`,
        DROP COLUMN \`venueName\`,
        DROP COLUMN \`lineItems\`,
        DROP COLUMN \`tax\`,
        DROP COLUMN \`taxType\`,
        DROP COLUMN \`service\`,
        DROP COLUMN \`serviceType\`,
        DROP COLUMN \`tip\`,
        DROP COLUMN \`tipType\`
    `);
  }
}
