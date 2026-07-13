import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogTable1751000100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`audit_log\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`shareId\` VARCHAR(36) NOT NULL,
        \`fromState\` VARCHAR(20) NULL,
        \`toState\` VARCHAR(20) NOT NULL,
        \`actor\` VARCHAR(36) NULL,
        \`source\` ENUM('user','webhook','reminder-job','system') NOT NULL,
        \`reason\` VARCHAR(255) NULL,
        \`metadata\` JSON NULL,
        \`createdAt\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_audit_log_shareId\` (\`shareId\`),
        CONSTRAINT \`FK_audit_log_shareId\` FOREIGN KEY (\`shareId\`) REFERENCES \`shares\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`audit_log\``);
  }
}
