/** Single normalisation point for Egyptian (+20) numbers used by Circle, ghosts, and claim-merge. */

export function normalizeEgPhone(raw: string): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('20')) return `+${digits}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
  if (digits.length === 10) return `+20${digits}`;
  return digits ? `+${digits}` : '';
}

export function phoneLookupVariants(phone: string): string[] {
  const n = normalizeEgPhone(phone);
  if (!n) return [phone];
  const noPlus = n.replace(/^\+/, '');
  const local = n.startsWith('+20') ? `0${n.slice(3)}` : n;
  return [...new Set([n, noPlus, local, phone.replace(/\s/g, '')].filter(Boolean))];
}
