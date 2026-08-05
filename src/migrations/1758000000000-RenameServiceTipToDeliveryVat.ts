import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameServiceTipToDeliveryVat1758000000000 implements MigrationInterface {
  name = 'RenameServiceTipToDeliveryVat1758000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`bills\`
        CHANGE COLUMN \`service\` \`delivery\` DECIMAL(10,2) NULL,
        CHANGE COLUMN \`serviceType\` \`deliveryType\` ENUM('percent','amount') NULL,
        CHANGE COLUMN \`tip\` \`vat\` DECIMAL(10,2) NULL,
        CHANGE COLUMN \`tipType\` \`vatType\` ENUM('percent','amount') NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`bills\`
        CHANGE COLUMN \`delivery\` \`service\` DECIMAL(10,2) NULL,
        CHANGE COLUMN \`deliveryType\` \`serviceType\` ENUM('percent','amount') NULL,
        CHANGE COLUMN \`vat\` \`tip\` DECIMAL(10,2) NULL,
        CHANGE COLUMN \`vatType\` \`tipType\` ENUM('percent','amount') NULL
    `);
  }
}
