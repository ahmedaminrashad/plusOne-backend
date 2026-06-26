import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';

export interface BillLineItem {
  name: string;
  qty: number;
  unitPrice: number;
}

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

  @Column({ type: 'decimal', precision: 10, scale: 2 })
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

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  tax: number | null;

  @Column({ type: 'enum', enum: ['percent', 'amount'], nullable: true })
  taxType: 'percent' | 'amount' | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  service: number | null;

  @Column({ type: 'enum', enum: ['percent', 'amount'], nullable: true })
  serviceType: 'percent' | 'amount' | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  tip: number | null;

  @Column({ type: 'enum', enum: ['percent', 'amount'], nullable: true })
  tipType: 'percent' | 'amount' | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
