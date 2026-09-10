import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserUnreadBadgeCount1759700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`unreadBadgeCount\` INT UNSIGNED NOT NULL DEFAULT 0 AFTER \`fcmToken\``,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`unreadBadgeCount\``);
  }
}
