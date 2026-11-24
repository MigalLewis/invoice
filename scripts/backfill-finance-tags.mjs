#!/usr/bin/env node
/**
 * Backfills normalized tagKeys on existing finance records.
 *
 * Dry run (default):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *     npm run migrate:finance-tags -- --project your-project-id
 * Apply:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *     npm run migrate:finance-tags -- --project your-project-id --apply
 *
 * Install firebase-admin first if it is not already available:
 *   npm install --no-save firebase-admin
 */

import {
  backfillRelationshipTags,
  tagKeysEqual
} from './lib/finance-tag-migration.mjs';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const projectArgIndex = process.argv.indexOf('--project');
const projectId = projectArgIndex >= 0 ? process.argv[projectArgIndex + 1] : process.env.GCLOUD_PROJECT;

if (!projectId) {
  console.error('Missing project id. Pass --project <project-id> or set GCLOUD_PROJECT.');
  process.exit(1);
}

let initializeApp;
let applicationDefault;
let getFirestore;
try {
  ({ initializeApp, applicationDefault } = await import('firebase-admin/app'));
  ({ getFirestore } = await import('firebase-admin/firestore'));
} catch {
  console.error('Missing firebase-admin. Install it with: npm install --no-save firebase-admin');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const stats = { scanned: 0, changed: 0, unchanged: 0, written: 0 };
let batch = db.batch();
let pendingWrites = 0;

async function flush() {
  if (!pendingWrites) return;
  if (apply) {
    await batch.commit();
    stats.written += pendingWrites;
  }
  batch = db.batch();
  pendingWrites = 0;
}

async function migrateDocument(document, fallbackClientId, fallbackProjectId) {
  stats.scanned += 1;
  const data = document.data();
  const tagKeys = backfillRelationshipTags(data, fallbackClientId, fallbackProjectId);
  if (tagKeysEqual(data.tagKeys, tagKeys)) {
    stats.unchanged += 1;
    return tagKeys;
  }

  stats.changed += 1;
  console.log(`${apply ? 'Updating' : '[dry-run] Would update'} ${document.ref.path}: ${JSON.stringify(tagKeys)}`);
  batch.update(document.ref, { tagKeys });
  pendingWrites += 1;
  if (pendingWrites >= 400) await flush();
  return tagKeys;
}

const companies = await db.collection('companies').get();
for (const company of companies.docs) {
  const [companyExpenses, statementData, summaries, clients] = await Promise.all([
    company.ref.collection('expenses').get(),
    company.ref.collection('statementData').get(),
    company.ref.collection('invoiceSummaries').get(),
    company.ref.collection('clients').get()
  ]);

  for (const expense of companyExpenses.docs) await migrateDocument(expense);
  for (const statement of statementData.docs) await migrateDocument(statement);
  const invoiceRelationships = new Map();

  for (const client of clients.docs) {
    const [expenses, invoices] = await Promise.all([
      client.ref.collection('expenses').get(),
      client.ref.collection('invoices').get()
    ]);

    for (const expense of expenses.docs) await migrateDocument(expense, client.id);
    for (const invoice of invoices.docs) {
      const invoiceData = invoice.data();
      invoiceRelationships.set(invoice.id, {
        clientId: client.id,
        projectId: invoiceData.projectId
      });
      await migrateDocument(invoice, client.id);
    }
  }

  for (const summary of summaries.docs) {
    const relationship = invoiceRelationships.get(summary.id);
    await migrateDocument(summary, relationship?.clientId, relationship?.projectId);
  }
}

await flush();
console.log(
  `Done. scanned=${stats.scanned} changed=${stats.changed} unchanged=${stats.unchanged} ` +
  `written=${stats.written} mode=${apply ? 'apply' : 'dry-run'}`
);
