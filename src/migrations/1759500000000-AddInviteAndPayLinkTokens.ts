import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInviteAndPayLinkTokens1759500000000 implements MigrationInterface {
  name = 'AddInviteAndPayLinkTokens1759500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ cs, coll }] = await queryRunner.query(`
      SELECT CHARACTER_SET_NAME AS cs, COLLATION_NAME AS coll
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'shares'
        AND COLUMN_NAME = 'id'
    `);
    const charset = cs || 'utf8mb4';
    const collation = coll || 'utf8mb4_unicode_ci';
    const idCol = `varchar(36) CHARACTER SET ${charset} COLLATE ${collation} NOT NULL`;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`invite_links\` (
        \`id\` ${idCol},
        \`token\` varchar(16) CHARACTER SET ${charset} COLLATE ${collation} NOT NULL,
        \`kind\` enum('circle','group') NOT NULL,
        \`ownerUserId\` ${idCol},
        \`groupId\` varchar(36) CHARACTER SET ${charset} COLLATE ${collation} NULL,
        \`phone\` varchar(20) CHARACTER SET ${charset} COLLATE ${collation} NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_invite_links_token\` (\`token\`),
        INDEX \`IDX_invite_links_owner\` (\`ownerUserId\`),
        INDEX \`IDX_invite_links_phone\` (\`phone\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS \`pay_link_tokens\``);
    await queryRunner.query(`
      CREATE TABLE \`pay_link_tokens\` (
        \`id\` ${idCol},
        \`token\` varchar(32) CHARACTER SET ${charset} COLLATE ${collation} NOT NULL,
        \`shareId\` ${idCol},
        \`expiresAt\` datetime(6) NOT NULL,
        \`openedAt\` datetime(6) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_pay_link_tokens_token\` (\`token\`),
        UNIQUE INDEX \`IDX_pay_link_tokens_share\` (\`shareId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_pay_link_tokens_share\` FOREIGN KEY (\`shareId\`) REFERENCES \`shares\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}
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
    await queryRunner.query(`DROP TABLE IF EXISTS \`pay_link_tokens\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`invite_links\``);
  }
}
