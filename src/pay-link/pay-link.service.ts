import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Share, ShareStatus } from '../shares/entities/share.entity';
import { buildInstaPayLink } from '../common/utils/instapay';

// This page is public/unauthenticated and renders user-supplied fields
// (display names, venue/group names) — escape before interpolating into HTML.
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
    requestedBy: (name: string) => `${name} طلب حصتك`,
    noAppNeeded: 'مش محتاج تطبيق. الفلوس هتروح على طول لـ',
    splitEqually: (count: number) => `مقسومة بالتساوي بين ${count} · شامل الضريبة والخدمة`,
    payButton: 'ادفع بـ InstaPay',
    neverHolds: 'InstaPay بيروح على طول للمستلم — +one مايمسكش الفلوس أبدًا.',
    cta: 'جرّب +one عشان تقسّم رحلتك الجاية ›',
    alreadySettled: 'الحصة دي اتسوّت خلاص، شكرًا ليك! 🎉',
    notFound: 'الرابط ده مش موجود أو منتهي.',
    noAlias: (name: string) => `${name} لسه مضافش رقم InstaPay.`,
  },
  en: {
    title: 'Pay your share',
    requestedBy: (name: string) => `${name} requested your share`,
    noAppNeeded: 'No app needed. Money goes directly to',
    splitEqually: (count: number) => `Split equally between ${count} · incl. VAT & service`,
    payButton: 'Pay with InstaPay',
    neverHolds: 'InstaPay goes directly to the recipient — +one never holds funds.',
    cta: 'Get +one to split your next outing ›',
    alreadySettled: 'This share is already settled — thank you! 🎉',
    notFound: "This link doesn't exist or has expired.",
    noAlias: (name: string) => `${name} hasn't added an InstaPay number yet.`,
  },
} as const;

function page(bodyHtml: string, lang: 'ar' | 'en'): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>+one</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #F4F3EF; color: #182320;
    font-family: -apple-system, Segoe UI, Roboto, Tahoma, Arial, sans-serif;
    padding: 24px;
  }
  .card { max-width: 400px; width: 100%; }
  .brand { text-align: center; font-weight: 800; font-size: 22px; color: #14665D; margin-bottom: 20px; }
  .panel { background: #fff; border-radius: 20px; padding: 24px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
  .subtitle { color: #66706B; font-size: 13px; margin-bottom: 4px; }
  .amount { font-size: 40px; font-weight: 800; color: #182320; margin: 8px 0; font-family: 'Courier New', monospace; }
  .meta { color: #98A19C; font-size: 13px; margin-bottom: 20px; }
  .pay-btn {
    display: block; width: 100%; padding: 16px; border-radius: 999px; background: #14665D;
    color: #fff; font-weight: 700; font-size: 16px; text-decoration: none; margin-bottom: 14px;
  }
  .note { color: #98A19C; font-size: 12px; line-height: 1.5; margin-top: 12px; }
  .cta { display: block; text-align: center; color: #14665D; font-size: 13px; font-weight: 600; margin-top: 24px; }
  .status-icon { font-size: 44px; margin-bottom: 12px; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">+one</div>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

@Injectable()
export class PayLinkService {
  constructor(@InjectRepository(Share) private sharesRepo: Repository<Share>) {}

  async renderPayPage(shareId: string, lang: 'ar' | 'en'): Promise<string> {
    const s = STRINGS[lang];
    const share = await this.sharesRepo.findOne({
      where: { id: shareId },
      relations: { initiator: true, bill: true, group: true },
    });

    if (!share) {
      return page(`<div class="panel"><div class="status-icon">🔗</div><div>${s.notFound}</div></div>`, lang);
    }

    if (share.status === ShareStatus.SETTLED) {
      return page(`<div class="panel"><div class="status-icon">✅</div><div>${s.alreadySettled}</div></div>`, lang);
    }

    const payerName = escapeHtml(share.initiator?.displayName ?? (lang === 'ar' ? 'صاحب الفاتورة' : 'the bill owner'));
    const amountText = (share.amountPiastres / 100).toFixed(2);
    const venue = escapeHtml(share.bill?.venueName ?? share.bill?.title ?? '');
    const groupName = escapeHtml(share.group?.name ?? '');
    const currency = escapeHtml(share.currency);

    if (!share.initiator?.instaPayAlias) {
      return page(`<div class="panel"><div class="status-icon">⚠️</div><div>${s.noAlias(payerName)}</div></div>`, lang);
    }

    const payLink = escapeHtml(buildInstaPayLink(share.initiator.instaPayAlias));

    return page(`
      <div class="panel">
        <div class="subtitle">${s.requestedBy(payerName)}</div>
        <div class="subtitle">${venue}${groupName ? ' · ' + groupName : ''}</div>
        <div class="amount">${currency} ${amountText}</div>
        <div class="meta">${s.noAppNeeded} ${payerName}</div>
        <a class="pay-btn" href="${payLink}">${s.payButton}</a>
        <div class="note">${s.neverHolds}</div>
      </div>
      <div class="cta">${s.cta}</div>
    `, lang);
  }
}
