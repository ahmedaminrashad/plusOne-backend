import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum InviteKind {
  CIRCLE = 'circle',
  GROUP = 'group',
}

@Entity('invite_links')
export class InviteLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 16 })
  token: string;

  @Column({ type: 'enum', enum: InviteKind })
  kind: InviteKind;

  @Index()
  @Column()
  ownerUserId: string;

  @Column({ type: 'varchar', nullable: true })
  groupId: string | null;

  @Index()
  @Column()
  phone: string;

  @CreateDateColumn()
  createdAt: Date;
}
