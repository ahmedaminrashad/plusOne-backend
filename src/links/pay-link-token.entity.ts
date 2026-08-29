import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Share } from '../shares/entities/share.entity';

@Entity('pay_link_tokens')
export class PayLinkToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 32 })
  token: string;

  @Index({ unique: true })
  @Column()
  shareId: string;

  @ManyToOne(() => Share, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shareId' })
  share: Share;

  @Column({ type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  openedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
