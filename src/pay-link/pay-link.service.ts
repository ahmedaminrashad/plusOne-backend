import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Share, ShareStatus, ShareMethod } from '../shares/entities/share.entity';
import { PayLinkToken } from '../links/pay-link-token.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { SharesStateService } from '../shares/shares-state.service';
import { AuditSource } from '../audit/entities/audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationTexts } from '../notifications/notification-texts';
import { buildInstaPayLink } from '../common/utils/instapay';
import { payToken } from '../common/utils/tokens';
import { payLinkMessage, publicAppOrigin } from '../common/utils/share-copy';

const PAY_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DAILY_PAY_LINK_CAP = 40;

const BRAND_MARK = `<div class="brand" dir="ltr">
  <svg class="brand-logo" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#14665D"/>
    <path d="M16 8v16M8 16h16" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>
  </svg>
  <span class="brand-name">+one</span>
</div>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STRINGS = {
  ar: {
    title: 'ادفع حصتك',
    requestedBy: (_name: string) => 'يطلب منك دفع نصيبك من فاتورة',
    payButton: 'ادفع بإنستاباي',
    cashButton: 'دفعت كاش',
    paidInstapay: 'دفعت بإنستاباي',
    neverHolds: (name: string) => `فلوس إنستاباي بتروح لـ ${name} على طول — بلس ون مابيمسكش فلوسك أبدًا.`,
    cta: 'حمّل بلس ون',
    alreadySettled: 'الحصة دي اتسوّت خلاص، شكرًا ليك!',
    expired: 'الرابط ده منتهي. اطلب رابط جديد من صاحبك.',
    notFound: 'الرابط ده مش موجود أو منتهي.',
    noAlias: (name: string) => `${name} لسه مضافش رقم إنستاباي.`,
    awaiting: 'اتبعت إشعار لصاحب الفاتورة. هيتأكد قبل ما تتحسب كمتسوّاة.',
    cashNoted: 'سجّلنا إنك دفعت كاش. صاحب الفاتورة لسه محتاج يأكّد الاستلام.',
    itemsTitle: 'تفاصيلك',
    langToggle: 'English',
  },
  en: {
    title: 'Pay your share',
    requestedBy: (name: string) => `${name} requested your share`,
    payButton: 'Pay with InstaPay',
    cashButton: 'I paid in cash',
    paidInstapay: "I've paid with InstaPay",
    neverHolds: (name: string) => `InstaPay goes directly to ${name} — +one never holds funds.`,
    cta: 'Get +one',
    alreadySettled: 'This share is already settled — thank you!',
    expired: 'This link has expired. Ask your friend for a new one.',
    notFound: "This link doesn't exist or has expired.",
    noAlias: (name: string) => `${name} hasn't added an InstaPay number yet.`,
    awaiting: 'We notified the person who paid. They confirm before this counts as settled.',
    cashNoted: 'Cash noted. The person who paid still needs to mark it received.',
    itemsTitle: 'Your items',
    langToggle: 'العربية',
  },
} as const;

@Injectable()
export class PayLinkService {
  constructor(
    @InjectRepository(Share) private sharesRepo: Repository<Share>,
    @InjectRepository(PayLinkToken) private tokensRepo: Repository<PayLinkToken>,
    @InjectRepository(GroupMember) private membersRepo: Repository<GroupMember>,
    private readonly dataSource: DataSource,
    private readonly stateService: SharesStateService,
    private readonly notifications: NotificationsService,
  ) {}

  async issue(shareId: string, userId: string): Promise<{ url: string; message: string; token: string }> {
    const share = await this.sharesRepo.findOne({
      where: { id: shareId },
      relations: { initiator: true, bill: true, owner: true },
    });
    if (!share) throw new NotFoundException('SHARE_NOT_FOUND');
    if (share.initiatorUserId !== userId) throw new ForbiddenException('NOT_BILL_INITIATOR');
    if (share.ownerUserId) throw new BadRequestException('SHARE_HAS_APP_USER');
    if (share.status === ShareStatus.SETTLED || share.status === ShareStatus.CANCELLED) {
      throw new ConflictException('SHARE_NOT_PAYABLE');
    }

    let tokenRow = await this.tokensRepo.findOne({ where: { shareId } });
    if (tokenRow && tokenRow.expiresAt < new Date()) {
      await this.tokensRepo.delete(tokenRow.id);
      tokenRow = null;
    }
    if (!tokenRow) {
      await this.assertDailyCap(userId);
      tokenRow = await this.tokensRepo.save({
        token: payToken(),
        shareId,
        expiresAt: new Date(Date.now() + PAY_LINK_TTL_MS),
        openedAt: null,
      });
    }

    if (share.status === ShareStatus.PENDING || share.status === ShareStatus.FAILED) {
      await this.dataSource.transaction((manager) =>
        this.stateService.transition(manager, share, ShareStatus.LINK_SENT, {
          actor: userId,
          source: AuditSource.USER,
          reason: 'pay_link_shared',
        }),
      );
    }

    const lang = share.initiator?.language === 'ar' ? 'ar' : 'en';
    const url = `${publicAppOrigin()}/p/${tokenRow.token}?lang=${lang}`;
    const amountEg = (share.amountPiastres / 100).toFixed(2);
    const venue = share.bill?.venueName ?? share.bill?.title ?? '';
    const message = payLinkMessage(
      lang,
      share.initiator?.displayName ?? '',
      venue,
      amountEg,
      url,
    );
    return { url, message, token: tokenRow.token };
  }

  async renderPayPage(token: string, lang: 'ar' | 'en'): Promise<string> {
    const s = STRINGS[lang];
    const row = await this.tokensRepo.findOne({ where: { token }, relations: { share: true } });
    if (!row) return this.shell(s.notFound, lang, { state: 'dead' });

    if (row.expiresAt < new Date()) {
      return this.shell(s.expired, lang, { state: 'dead' });
    }

    const share = await this.sharesRepo.findOne({
      where: { id: row.shareId },
      relations: { initiator: true, bill: true, group: true },
    });
    if (!share) return this.shell(s.notFound, lang, { state: 'dead' });

    if (share.status === ShareStatus.SETTLED) {
      return this.shell(s.alreadySettled, lang, { state: 'done' });
    }
    if (
      share.status === ShareStatus.PENDING_CONFIRMATION ||
      share.status === ShareStatus.INITIATED
    ) {
      return this.shell(s.awaiting, lang, { state: 'done' });
    }

    if (!row.openedAt) {
      row.openedAt = new Date();
      await this.tokensRepo.save(row);
      if (share.status === ShareStatus.LINK_SENT || share.status === ShareStatus.PENDING) {
        await this.dataSource.transaction((manager) =>
          this.stateService.transition(manager, share, ShareStatus.LINK_OPENED, {
            actor: null,
            source: AuditSource.SYSTEM,
            reason: 'pay_link_opened',
          }),
        );
        share.status = ShareStatus.LINK_OPENED;
      }
    }

    const payerName = share.initiator?.displayName ?? (lang === 'ar' ? 'صاحب الفاتورة' : 'the bill owner');
    const amountText = (share.amountPiastres / 100).toFixed(2);
    const venue = share.bill?.venueName ?? share.bill?.title ?? '';
    const groupName = share.group?.name ?? '';
    const currency = share.currency;
    const itemsHtml = await this.itemsBreakdown(share, lang);

    if (!share.initiator?.instaPayAlias) {
      return this.shell(s.noAlias(escapeHtml(payerName)), lang, { state: 'dead' });
    }

    const payHref = escapeHtml(buildInstaPayLink(share.initiator.instaPayAlias));
    const otherLang = lang === 'ar' ? 'en' : 'ar';
    const toggleHref = `/p/${encodeURIComponent(token)}?lang=${otherLang}`;

    return this.page(`
      <div class="lang"><a href="${toggleHref}">${s.langToggle}</a></div>
      <div class="panel">
        <div class="payer-name" dir="auto">${escapeHtml(payerName)}</div>
        <div class="subtitle">${escapeHtml(s.requestedBy(payerName))}</div>
        <div class="subtitle">${escapeHtml(venue)}${groupName ? ' · ' + escapeHtml(groupName) : ''}</div>
        <div class="amount">${escapeHtml(currency)} ${amountText}</div>
        ${itemsHtml}
        <a class="pay-btn" href="${payHref}">${s.payButton}</a>
        <form method="POST" action="/p/${encodeURIComponent(token)}/paid">
          <input type="hidden" name="method" value="instapay"/>
          <input type="hidden" name="lang" value="${lang}"/>
          <button class="ghost-btn" type="submit">${s.paidInstapay}</button>
        </form>
        <form method="POST" action="/p/${encodeURIComponent(token)}/paid">
          <input type="hidden" name="method" value="cash"/>
          <input type="hidden" name="lang" value="${lang}"/>
          <button class="ghost-btn" type="submit">${s.cashButton}</button>
        </form>
        <div class="note">${escapeHtml(s.neverHolds(payerName))}</div>
      </div>
      <a class="cta" href="${publicAppOrigin()}">${s.cta}</a>
    `, lang);
  }

  async markPaid(token: string, method: 'cash' | 'instapay', lang: 'ar' | 'en'): Promise<string> {
    const s = STRINGS[lang];
    const row = await this.tokensRepo.findOne({ where: { token } });
    if (!row || row.expiresAt < new Date()) return this.shell(s.expired, lang, { state: 'dead' });

    const share = await this.sharesRepo.findOne({
      where: { id: row.shareId },
      relations: { initiator: true, bill: true, owner: true, group: true },
    });
    if (!share) return this.shell(s.notFound, lang, { state: 'dead' });
    if (share.status === ShareStatus.SETTLED) return this.shell(s.alreadySettled, lang, { state: 'done' });
    if (share.status === ShareStatus.PENDING_CONFIRMATION || share.status === ShareStatus.INITIATED) {
      return this.shell(s.awaiting, lang, { state: 'done' });
    }

    share.method = method === 'cash' ? ShareMethod.CASH : ShareMethod.INSTAPAY;
    await this.dataSource.transaction((manager) =>
      this.stateService.transition(manager, share, ShareStatus.PENDING_CONFIRMATION, {
        actor: null,
        source: AuditSource.SYSTEM,
        reason: method === 'cash' ? 'web_cash_claimed' : 'web_instapay_claimed',
      }),
    );

    if (share.initiator?.fcmToken) {
      const nlang = share.initiator.language === 'ar' ? 'ar' : 'en';
      await this.notifications.send(
        share.initiator.fcmToken,
        notificationTexts.shareInitiated(nlang, {
          ownerName: share.ownerPendingPhone ?? (nlang === 'en' ? 'A +1' : 'ضيف'),
          amountPiastres: share.amountPiastres,
          currency: share.currency,
          billTitle: share.bill?.title ?? (nlang === 'en' ? 'the receipt' : 'الإيصال'),
        }),
        {
          type: 'share_initiated',
          shareId: share.id,
          groupId: share.groupId,
          billId: share.billId,
          groupName: share.group?.name ?? share.bill?.group?.name ?? '',
        },
      );
    }

    return this.shell(method === 'cash' ? s.cashNoted : s.awaiting, lang, { state: 'done' });
  }

  async renderByShareId(shareId: string, lang: 'ar' | 'en'): Promise<string> {
    const row = await this.tokensRepo.findOne({ where: { shareId } });
    if (row) return this.renderPayPage(row.token, lang);
    return this.renderPayPage('missing', lang);
  }

  private async itemsBreakdown(share: Share, lang: 'ar' | 'en'): Promise<string> {
    const items = share.bill?.lineItems ?? [];
    if (!items.length) return '';
    const members = await this.membersRepo.find({ where: { groupId: share.groupId } });
    const mine = members.filter(
      (m) =>
        (share.ownerUserId && m.userId === share.ownerUserId) ||
        (share.ownerPendingPhone && m.pendingPhone === share.ownerPendingPhone),
    );
    const ids = new Set(mine.flatMap((m) => [m.id, m.userId].filter(Boolean) as string[]));
    const mineItems = items.filter((it) => (it.claimedBy ?? []).some((id) => ids.has(id)));
    if (!mineItems.length) return '';
    const rows = mineItems
      .map((it) => `<li>${escapeHtml(it.name)} · ${(it.qty * it.unitPrice).toFixed(2)}</li>`)
      .join('');
    return `<div class="items"><div class="items-title">${STRINGS[lang].itemsTitle}</div><ul>${rows}</ul></div>`;
  }

  private async assertDailyCap(userId: string): Promise<void> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const count = await this.tokensRepo
      .createQueryBuilder('t')
      .innerJoin(Share, 's', 's.id = t.shareId')
      .where('s.initiatorUserId = :userId', { userId })
      .andWhere('t.createdAt > :since', { since })
      .getCount();
    if (count >= DAILY_PAY_LINK_CAP) throw new BadRequestException('PAY_LINK_RATE_LIMITED');
  }

  private shell(message: string, lang: 'ar' | 'en', opts: { state: 'dead' | 'done' }): string {
    const icon = opts.state === 'done' ? '✅' : '🔗';
    return this.page(
      `<div class="panel"><div class="status-icon">${icon}</div><div>${escapeHtml(message)}</div></div>`,
      lang,
    );
  }

  private page(bodyHtml: string, lang: 'ar' | 'en'): string {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const ogTitle = 'A payment request on +one';
    const ogDesc = 'Open this link to pay your share.';
    return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta property="og:title" content="${ogTitle}" />
<meta property="og:description" content="${ogDesc}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${ogTitle}" />
<meta name="twitter:description" content="${ogDesc}" />
<title>+one</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #F4F3EF; color: #182320; font-family: -apple-system, Segoe UI, Roboto, Tahoma, Arial, sans-serif; padding: 24px; }
  .card { max-width: 400px; width: 100%; }
  .brand { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px; unicode-bidi: isolate; }
  .brand-logo { width: 32px; height: 32px; display: block; }
  .brand-name { font-weight: 800; font-size: 22px; color: #14665D; letter-spacing: -0.02em; }
  .lang { text-align: ${lang === 'ar' ? 'left' : 'right'}; margin-bottom: 8px; }
  .lang a { color: #14665D; font-size: 13px; font-weight: 600; text-decoration: none; }
  .panel { background: #fff; border-radius: 20px; padding: 24px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
  .payer-name { color: #182320; font-size: 15px; font-weight: 700; margin-bottom: 2px; unicode-bidi: isolate; }
  .subtitle { color: #66706B; font-size: 13px; margin-bottom: 4px; }
  .amount { font-size: 40px; font-weight: 800; color: #182320; margin: 8px 0; }
  .pay-btn, .ghost-btn {
    display: block; width: 100%; padding: 16px; border-radius: 999px; font-weight: 700; font-size: 16px;
    text-decoration: none; margin-bottom: 10px; border: 0; cursor: pointer; font-family: inherit;
  }
  .pay-btn { background: #14665D; color: #fff; }
  .ghost-btn { background: #fff; color: #14665D; border: 1.5px solid #14665D; }
  .note { color: #98A19C; font-size: 12px; line-height: 1.5; margin-top: 12px; }
  .cta { display: block; text-align: center; color: #14665D; font-size: 13px; font-weight: 600; margin-top: 24px; unicode-bidi: isolate; direction: ${dir}; }
  .status-icon { font-size: 44px; margin-bottom: 12px; }
  .items { text-align: ${lang === 'ar' ? 'right' : 'left'}; margin: 12px 0 16px; }
  .items-title { font-size: 12px; color: #66706B; margin-bottom: 6px; }
  .items ul { margin: 0; padding: ${lang === 'ar' ? '0 18px 0 0' : '0 0 0 18px'}; color: #182320; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    ${BRAND_MARK}
    ${bodyHtml}
  </div>
</body>
</html>`;
  }
}
