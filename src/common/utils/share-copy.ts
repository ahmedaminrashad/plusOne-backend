const RLM = '\u200F';

export type AppLang = 'ar' | 'en';

export function publicAppOrigin(): string {
  // Landing pages (/i/:token, /p/:token) are served by Nest on the API host.
  // plusone-app.com is the Hostinger marketing site and 404s those paths unless
  // you proxy /i/ and /p/ there. Override with PUBLIC_APP_URL when that exists.
  return (process.env.PUBLIC_APP_URL ?? 'https://api.plusone-app.com').replace(/\/$/, '');
}

export function circleInviteMessage(lang: AppLang, inviterName: string, url: string): string {
  const name = inviterName.trim() || (lang === 'ar' ? 'صديقك' : 'A friend');
  if (lang === 'ar') {
    return `${RLM}${name} اضافك على بلس ون — أسهل طريقة تقسّم الحساب مع صحابك.\n${RLM}حمّل التطبيق: ${url}`;
  }
  return `${name} added you on +one — the easy way to split bills with friends.\nGet the app: ${url}`;
}

export function groupInviteMessage(
  lang: AppLang,
  inviterName: string,
  groupName: string,
  url: string,
): string {
  const name = inviterName.trim() || (lang === 'ar' ? 'صديقك' : 'A friend');
  if (lang === 'ar') {
    return `${RLM}${name} اضافك في "${groupName}" على بلس ون — قسّموا الحساب من غير حسابات معقدة.\n${RLM}حمّل التطبيق: ${url}`;
  }
  return `${name} added you to "${groupName}" on +one — split bills together, no awkward math.\nGet the app: ${url}`;
}

export function payLinkMessage(
  lang: AppLang,
  requesterName: string,
  venue: string,
  amountEg: string,
  url: string,
): string {
  const name = requesterName.trim() || (lang === 'ar' ? 'صديقك' : 'A friend');
  const bill = venue.trim() || (lang === 'ar' ? 'الفاتورة' : 'the receipt');
  if (lang === 'ar') {
    return `${RLM}${name} يطلب منك دفع نصيبك من فاتورة ${bill}: ${amountEg} ج.م\n${RLM}ادفع بإنستاباي: ${url}`;
  }
  return `${name} requested your share of ${bill}: EGP ${amountEg}\nPay with InstaPay: ${url}`;
}
