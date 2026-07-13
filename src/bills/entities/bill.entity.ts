import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';

export interface BillLineItem {
  name: string;
  qty: number;
  unitPrice: number;
}

// mysql2 returns DECIMAL columns as strings; coerce to number so callers can safely do arithmetic/.toFixed() on them.
const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};

@Entity('bills')
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column({ type: 'varchar', nullable: true, default: null })
  title: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  amount: number;

  @Column({ default: 'EGP' })
  currency: string;

  @Column()
  paidByUserId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'paidByUserId' })
  paidBy: User;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  receiptPhotoUrl: string;

  @Column({ type: 'enum', enum: ['qr', 'manual', 'ocr'], default: 'manual' })
  captureMethod: 'qr' | 'manual' | 'ocr';

  @Column({ type: 'varchar', nullable: true, length: 500 })
  sourceRef: string | null;

  @Column({ type: 'varchar', nullable: true })
  venueName: string | null;

  @Column({ type: 'json', nullable: true })
  lineItems: BillLineItem[] | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  tax: number | null;

  @Column({ type: 'enum', enum: ['percent', 'amount'], nullable: true })
  taxType: 'percent' | 'amount' | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  service: number | null;

  @Column({ type: 'enum', enum: ['percent', 'amount'], nullable: true })
  serviceType: 'percent' | 'amount' | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  tip: number | null;

  @Column({ type: 'enum', enum: ['percent', 'amount'], nullable: true })
  tipType: 'percent' | 'amount' | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
