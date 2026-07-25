import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum FriendStatus {
  ACTIVE = 'active',   // friendUserId points at a registered +one user
  PENDING = 'pending', // invited by phone, not on +one yet — a "+1"
}

@Entity('friends')
@Unique(['ownerUserId', 'friendUserId'])
@Unique(['ownerUserId', 'pendingPhone'])
export class Friend {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  ownerUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId' })
  owner: User;

  @Index()
  @Column({ nullable: true })
  friendUserId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'friendUserId' })
  friend: User;

  @Column({ nullable: true })
  pendingPhone: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ type: 'enum', enum: FriendStatus, default: FriendStatus.ACTIVE })
  status: FriendStatus;

  @CreateDateColumn()
  createdAt: Date;
}
