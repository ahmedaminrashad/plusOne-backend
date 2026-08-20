import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupDeletedAtAndUserLanguageDefault1759000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`groups\`
      ADD COLUMN \`deletedAt\` DATETIME(6) NULL DEFAULT NULL AFTER \`avatarUrl\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`users\`
      MODIFY COLUMN \`language\` ENUM('ar','en') NOT NULL DEFAULT 'en'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
      MODIFY COLUMN \`language\` ENUM('ar','en') NOT NULL DEFAULT 'ar'
    `);
    await queryRunner.query(`
      ALTER TABLE \`groups\`
      DROP COLUMN \`deletedAt\`
    `);
  }
}
