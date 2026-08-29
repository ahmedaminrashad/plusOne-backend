import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInviteAndPayLinkTokens1759500000000 implements MigrationInterface {
  name = 'AddInviteAndPayLinkTokens1759500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`invite_links\` (
        \`id\` varchar(36) NOT NULL,
        \`token\` varchar(16) NOT NULL,
        \`kind\` enum('circle','group') NOT NULL,
        \`ownerUserId\` varchar(36) NOT NULL,
        \`groupId\` varchar(36) NULL,
        \`phone\` varchar(20) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_invite_links_token\` (\`token\`),
        INDEX \`IDX_invite_links_owner\` (\`ownerUserId\`),
        INDEX \`IDX_invite_links_phone\` (\`phone\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`pay_link_tokens\` (
        \`id\` varchar(36) NOT NULL,
        \`token\` varchar(32) NOT NULL,
        \`shareId\` varchar(36) NOT NULL,
        \`expiresAt\` datetime(6) NOT NULL,
        \`openedAt\` datetime(6) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_pay_link_tokens_token\` (\`token\`),
        UNIQUE INDEX \`IDX_pay_link_tokens_share\` (\`shareId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_pay_link_tokens_share\` FOREIGN KEY (\`shareId\`) REFERENCES \`shares\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      ALTER TABLE \`shares\`
      MODIFY COLUMN \`status\` enum(
        'pending','initiated','settled','cancelled','failed',
        'link_sent','link_opened','pending_confirmation'
      ) NOT NULL DEFAULT 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`shares\`
      MODIFY COLUMN \`status\` enum('pending','initiated','settled','cancelled','failed') NOT NULL DEFAULT 'pending'
    `);
    await queryRunner.query(`DROP TABLE \`pay_link_tokens\``);
    await queryRunner.query(`DROP TABLE \`invite_links\``);
  }
}
