import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Share } from '../../shares/entities/share.entity';

export enum AuditSource {
  USER = 'user',
  WEBHOOK = 'webhook',
  REMINDER_JOB = 'reminder-job',
  SYSTEM = 'system',
}

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  shareId: string;

  @ManyToOne(() => Share, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shareId' })
  share: Share;

  @Column({ type: 'varchar', nullable: true })
  fromState: string | null;

  @Column({ type: 'varchar' })
  toState: string;

  @Column({ type: 'varchar', nullable: true })
  actor: string | null;

  @Column({ type: 'enum', enum: AuditSource })
  source: AuditSource;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
