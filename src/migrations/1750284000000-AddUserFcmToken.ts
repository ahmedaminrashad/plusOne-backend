import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserFcmToken1750284000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`fcmToken\` VARCHAR(255) NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`fcmToken\``);
  }
}
