export const FINANCE_TAG_TYPES = new Set([
  'company',
  'client',
  'project',
  'vat',
  'category',
  'status',
  'recurrence',
  'custom'
]);

export function normalizeFinanceTagKeys(value) {
  if (!Array.isArray(value)) return [];

  const normalized = [];
  const seen = new Set();
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue;
    const key = candidate.trim();
    const separatorIndex = key.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex === key.length - 1) continue;

    const type = key.slice(0, separatorIndex);
    const tagValue = key.slice(separatorIndex + 1).trim();
    if (!FINANCE_TAG_TYPES.has(type) || !tagValue) continue;

    const normalizedKey = `${type}:${tagValue}`;
    if (!seen.has(normalizedKey)) {
      normalized.push(normalizedKey);
      seen.add(normalizedKey);
    }
  }
  return normalized;
}

export function backfillRelationshipTags(record, fallbackClientId, fallbackProjectId) {
  const tagKeys = normalizeFinanceTagKeys(record?.tagKeys);
  const clientId = normalizedId(record?.clientId) || normalizedId(fallbackClientId);
  const projectId = normalizedId(record?.projectId) || normalizedId(fallbackProjectId);

  appendUnique(tagKeys, clientId ? `client:${clientId}` : undefined);
  appendUnique(tagKeys, projectId ? `project:${projectId}` : undefined);
  return tagKeys;
}

export function tagKeysEqual(currentValue, nextValue) {
  if (!Array.isArray(currentValue) || currentValue.length !== nextValue.length) return false;
  return currentValue.every((value, index) => value === nextValue[index]);
}

function normalizedId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function appendUnique(values, value) {
  if (value && !values.includes(value)) values.push(value);
}
