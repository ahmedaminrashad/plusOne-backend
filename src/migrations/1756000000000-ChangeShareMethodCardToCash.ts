import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeShareMethodCardToCash1756000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`shares\`
      MODIFY COLUMN \`method\` ENUM('instapay','cash') NOT NULL DEFAULT 'instapay'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`shares\` SET \`method\` = 'instapay' WHERE \`method\` = 'cash'
    `);
    await queryRunner.query(`
      ALTER TABLE \`shares\`
      MODIFY COLUMN \`method\` ENUM('instapay','card') NOT NULL DEFAULT 'instapay'
    `);
  }
}
