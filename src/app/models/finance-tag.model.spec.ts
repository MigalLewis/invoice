import {
  buildFinanceTagKey,
  createCustomFinanceTag,
  createFinanceTag,
  deduplicateFinanceTags,
  normalizeFinanceTagKeys,
  parseFinanceTagKey
} from './finance-tag.model';

describe('finance tag utilities', () => {
  it('creates entity tags with stable ids and display context', () => {
    expect(createFinanceTag('project', 'Website Redesign', 'project-123', 'Acme Ltd')).toEqual({
      key: 'project:project-123',
      type: 'project',
      label: 'Website Redesign',
      entityId: 'project-123',
      contextLabel: 'Acme Ltd'
    });
  });

  it('normalizes custom tag labels into deterministic keys', () => {
    expect(createCustomFinanceTag('  Audit & Review  ')).toEqual({
      key: 'custom:audit-and-review',
      type: 'custom',
      label: 'Audit & Review'
    });
  });

  it('parses tag keys without losing colons in their values', () => {
    expect(parseFinanceTagKey('custom:year:2026')).toEqual({ type: 'custom', value: 'year:2026' });
    expect(parseFinanceTagKey('unknown:value')).toBeNull();
    expect(() => buildFinanceTagKey('client', '  ')).toThrowError();
  });

  it('deduplicates tags and rejects malformed stored keys', () => {
    const client = createFinanceTag('client', 'Acme Ltd', 'client-1');
    const replacement = { ...client, label: 'Acme Holdings' };

    expect(deduplicateFinanceTags([client, replacement])).toEqual([replacement]);
    expect(normalizeFinanceTagKeys([
      ' client:client-1 ',
      'client:client-1',
      'vat:claimable',
      'not-a-tag'
    ])).toEqual(['client:client-1', 'vat:claimable']);
  });
});
