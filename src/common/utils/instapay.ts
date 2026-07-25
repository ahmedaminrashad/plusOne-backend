// Mirrors mobile/src/utils/instapay.ts — kept in sync manually since the public
// pay-link page (server-rendered, no app installed) needs the same link format
// as the in-app payer flow.
export function normalizeInstaPayIdentifier(alias: string): string {
  const trimmed = alias.trim();
  if (!/^\+?\d{7,15}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/^\+/, '');
  if (digits.startsWith('20')) return `0${digits.slice(2)}`;
  if (digits.startsWith('0')) return digits;
  return `0${digits}`;
}

export function buildInstaPayLink(alias: string): string {
  return `https://ipn.eg/S/${encodeURIComponent(normalizeInstaPayIdentifier(alias))}`;
}
