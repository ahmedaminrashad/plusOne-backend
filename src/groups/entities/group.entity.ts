import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { GroupMember } from './group-member.entity';

export enum GroupCategory {
  FRIENDS = 'friends',
  FAMILY = 'family',
  WORK = 'work',
  TRAVEL = 'travel',
  OTHER = 'other',
}

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'enum', enum: GroupCategory })
  category: GroupCategory;

  @Column({ nullable: true })
  avatarUrl: string;

  @OneToMany(() => GroupMember, (member) => member.group, { cascade: true })
  members: GroupMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
