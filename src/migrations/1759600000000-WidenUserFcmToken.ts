import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenUserFcmToken1759600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`fcmToken\` TEXT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`fcmToken\` VARCHAR(255) NULL`,
    );
  }
}
