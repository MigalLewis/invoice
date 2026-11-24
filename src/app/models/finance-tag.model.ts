export const FINANCE_TAG_TYPES = [
  'company',
  'client',
  'project',
  'vat',
  'category',
  'status',
  'recurrence',
  'custom'
] as const;

export type FinanceTagType = typeof FINANCE_TAG_TYPES[number];
export type FinanceTagKey = `${FinanceTagType}:${string}`;

export interface FinanceTag {
  key: FinanceTagKey;
  type: FinanceTagType;
  label: string;
  entityId?: string;
  contextLabel?: string;
}

export interface FinanceTagGroup {
  type: FinanceTagType;
  label: string;
  options: FinanceTag[];
}

export interface TaggableFinanceRecord {
  tagKeys?: FinanceTagKey[];
}

export const SINGLE_VALUE_TAG_TYPES: ReadonlySet<FinanceTagType> = new Set([
  'company',
  'client',
  'project',
  'vat',
  'category',
  'status',
  'recurrence'
]);

export function buildFinanceTagKey(type: FinanceTagType, value: string): FinanceTagKey {
  const normalizedValue = value.trim();
  if (!normalizedValue) throw new Error('A finance tag key requires a value.');
  return `${type}:${normalizedValue}`;
}

export function parseFinanceTagKey(key: string): { type: FinanceTagType; value: string } | null {
  const separatorIndex = key.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === key.length - 1) return null;

  const type = key.slice(0, separatorIndex);
  const value = key.slice(separatorIndex + 1);
  if (!isFinanceTagType(type) || !value) return null;
  return { type, value };
}

export function createFinanceTag(
  type: FinanceTagType,
  label: string,
  entityId?: string,
  contextLabel?: string
): FinanceTag {
  const normalizedLabel = label.trim();
  if (!normalizedLabel) throw new Error('A finance tag requires a label.');

  const value = entityId?.trim() || normalizeFinanceTagToken(normalizedLabel);
  return {
    key: buildFinanceTagKey(type, value),
    type,
    label: normalizedLabel,
    ...(entityId?.trim() ? { entityId: entityId.trim() } : {}),
    ...(contextLabel?.trim() ? { contextLabel: contextLabel.trim() } : {})
  };
}

export function createCustomFinanceTag(label: string): FinanceTag {
  return createFinanceTag('custom', label);
}

export function deduplicateFinanceTags(tags: readonly FinanceTag[]): FinanceTag[] {
  return [...new Map(tags.map(tag => [tag.key, tag])).values()];
}

export function normalizeFinanceTagKeys(keys: readonly string[]): FinanceTagKey[] {
  return [...new Set(keys.map(key => key.trim()).filter(isFinanceTagKey))];
}

export function isFinanceTagType(value: string): value is FinanceTagType {
  return (FINANCE_TAG_TYPES as readonly string[]).includes(value);
}

export function isFinanceTagKey(value: string): value is FinanceTagKey {
  return parseFinanceTagKey(value) !== null;
}

export function normalizeFinanceTagToken(value: string): string {
  const token = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!token) throw new Error('A finance tag requires letters or numbers.');
  return token;
}
