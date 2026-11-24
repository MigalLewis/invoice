import assert from 'node:assert/strict';
import test from 'node:test';
import {
  backfillRelationshipTags,
  normalizeFinanceTagKeys,
  tagKeysEqual
} from './lib/finance-tag-migration.mjs';

test('normalizes, validates, and deduplicates existing tag keys', () => {
  assert.deepEqual(
    normalizeFinanceTagKeys([' custom:Travel ', 'custom:Travel', 'invalid', 'unknown:value', null]),
    ['custom:Travel']
  );
});

test('backfills client and project relationships without replacing existing tags', () => {
  assert.deepEqual(
    backfillRelationshipTags({
      clientId: 'client-1',
      projectId: 'project-1',
      tagKeys: ['vat:claimable', 'client:client-1']
    }),
    ['vat:claimable', 'client:client-1', 'project:project-1']
  );
});

test('uses the parent client for nested records but respects an explicit client id', () => {
  assert.deepEqual(backfillRelationshipTags({}, 'parent-client'), ['client:parent-client']);
  assert.deepEqual(
    backfillRelationshipTags({ clientId: 'explicit-client' }, 'parent-client'),
    ['client:explicit-client']
  );
});

test('uses source invoice relationships when a legacy summary does not contain them', () => {
  assert.deepEqual(
    backfillRelationshipTags({ tagKeys: ['status:sent'] }, 'client-1', 'project-1'),
    ['status:sent', 'client:client-1', 'project:project-1']
  );
});

test('backfill is idempotent', () => {
  const first = backfillRelationshipTags({ clientId: 'client-1', projectId: 'project-1' });
  const second = backfillRelationshipTags({
    clientId: 'client-1',
    projectId: 'project-1',
    tagKeys: first
  });

  assert.deepEqual(second, first);
  assert.equal(tagKeysEqual(first, second), true);
});
