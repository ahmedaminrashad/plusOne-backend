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
import { Group } from './group.entity';
import { User } from '../../users/entities/user.entity';

export enum MemberRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum MemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  REMOVED = 'removed',
}

@Entity('group_members')
@Unique(['groupId', 'userId'])
@Unique(['groupId', 'pendingPhone'])
export class GroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  groupId: string;

  @ManyToOne(() => Group, (group) => group.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Index()
  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  pendingPhone: string;

  @Column({ type: 'enum', enum: MemberRole, default: MemberRole.MEMBER })
  role: MemberRole;

  @Column({ type: 'enum', enum: MemberStatus, default: MemberStatus.ACTIVE })
  status: MemberStatus;

  @Column({ nullable: true })
  removedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
