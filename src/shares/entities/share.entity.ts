import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Bill } from '../../bills/entities/bill.entity';
import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';

export enum ShareStatus {
  PENDING = 'pending',
  INITIATED = 'initiated',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum ShareMethod {
  INSTAPAY = 'instapay',
  CARD = 'card',
}

export enum ShareFailureReason {
  PAYMENT_NOT_RECEIVED = 'payment_not_received',
  MEMBER_CANCELLED = 'member_cancelled',
  WRONG_AMOUNT = 'wrong_amount',
  CONFIRMED_BY_MISTAKE = 'confirmed_by_mistake',
  OTHER = 'other',
}

@Entity('shares')
@Unique(['billId', 'ownerUserId'])
@Unique(['billId', 'ownerPendingPhone'])
export class Share {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  billId: string;

  @ManyToOne(() => Bill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billId' })
  bill: Bill;

  @Index()
  @Column()
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Index()
  @Column()
  initiatorUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'initiatorUserId' })
  initiator: User;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerUserId' })
  owner: User | null;

  @Column({ type: 'varchar', nullable: true })
  ownerPendingPhone: string | null;

  @Column({ type: 'int' })
  amountPiastres: number;

  @Column({ default: 'EGP' })
  currency: string;

  @Column({ type: 'enum', enum: ShareStatus, default: ShareStatus.PENDING })
  status: ShareStatus;

  @Column({ type: 'enum', enum: ShareMethod, default: ShareMethod.INSTAPAY })
  method: ShareMethod;

  @Column({ type: 'varchar', length: 40, nullable: true })
  reference: string | null;

  @Column({ type: 'enum', enum: ShareFailureReason, nullable: true })
  failureReason: ShareFailureReason | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  initiatedAt: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  lastReminderSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
