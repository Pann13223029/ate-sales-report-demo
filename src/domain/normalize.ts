function normalizeBaseText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeCustomerName(value: string): string {
  return normalizeBaseText(value);
}

export function normalizeProductName(value: string): string {
  const normalized = normalizeBaseText(value)
    .replace(/\s*([/+-])\s*/g, '$1')
    .replace(/([a-z])\s+(\d)/gi, '$1$2')
    .replace(/(\d)\s+([a-z])/gi, '$1$2');

  return normalized;
}

export function trimBusinessText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}
