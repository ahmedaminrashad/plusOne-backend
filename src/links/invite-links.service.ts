import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { InviteKind, InviteLink } from './invite-link.entity';
import { inviteToken } from '../common/utils/tokens';
import { normalizeEgPhone } from '../common/utils/phone';
import { circleInviteMessage, groupInviteMessage, publicAppOrigin } from '../common/utils/share-copy';

const DAILY_INVITE_CAP = 40;

@Injectable()
export class InviteLinksService {
  constructor(
    @InjectRepository(InviteLink) private readonly linksRepo: Repository<InviteLink>,
  ) {}

  async issue(params: {
    ownerUserId: string;
    kind: InviteKind;
    phone: string;
    groupId?: string | null;
    inviterName: string;
    language: 'ar' | 'en';
    groupName?: string;
  }): Promise<{ url: string; message: string; token: string }> {
    const phone = normalizeEgPhone(params.phone);
    const existing = await this.linksRepo.findOne({
      where: {
        ownerUserId: params.ownerUserId,
        kind: params.kind,
        phone,
        ...(params.groupId ? { groupId: params.groupId } : { groupId: IsNull() }),
      },
    });

    if (!existing) {
      await this.assertDailyCap(params.ownerUserId);
    }

    const row =
      existing ??
      (await this.linksRepo.save({
        token: inviteToken(),
        kind: params.kind,
        ownerUserId: params.ownerUserId,
        groupId: params.groupId ?? null,
        phone,
      }));

    const url = `${publicAppOrigin()}/i/${row.token}`;
    const message =
      params.kind === InviteKind.GROUP
        ? groupInviteMessage(params.language, params.inviterName, params.groupName ?? '', url)
        : circleInviteMessage(params.language, params.inviterName, url);
    return { url, message, token: row.token };
  }

  async findByToken(token: string): Promise<InviteLink | null> {
    return this.linksRepo.findOne({ where: { token } });
  }

  private async assertDailyCap(ownerUserId: string): Promise<void> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const count = await this.linksRepo.count({
      where: { ownerUserId, createdAt: MoreThan(since) },
    });
    if (count >= DAILY_INVITE_CAP) {
      throw new BadRequestException('INVITE_RATE_LIMITED');
    }
  }
}
