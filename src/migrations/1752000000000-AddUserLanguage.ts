import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLanguage1752000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`language\` ENUM('ar','en') NOT NULL DEFAULT 'ar' AFTER \`fcmToken\``,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`language\``);
  }
}
