import assert from 'node:assert/strict';

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const projectId = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_CONFIG?.projectId ?? 'demo-invoice-ci';
const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;

function token(uid) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ user_id: uid, sub: uid, aud: projectId, iss: 'https://securetoken.google.com/' + projectId, iat: 0, exp: 4102444800 })).toString('base64url');
  return `${header}.${payload}.`;
}

function authHeaders(uid) {
  return uid ? { Authorization: `Bearer ${token(uid)}` } : {};
}

function firestoreValue(value) {
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'object') return { mapValue: { fields: fields(value) } };
  return { stringValue: String(value) };
}

function fields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)]));
}

async function write(path, data, uid, method = 'PATCH') {
  return fetch(`${base}/${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...authHeaders(uid) },
    body: JSON.stringify({ fields: fields(data) })
  });
}

async function read(path, uid) {
  return fetch(`${base}/${path}`, { headers: authHeaders(uid) });
}

async function expectAllowed(promise, message) {
  const response = await promise;
  assert.ok(response.ok, `${message}: expected allowed, got ${response.status} ${await response.text()}`);
}

async function expectDenied(promise, message) {
  const response = await promise;
  assert.ok([401, 403, 404].includes(response.status), `${message}: expected denied, got ${response.status}`);
}

await expectAllowed(write('users/alice', { uid: 'alice', companyId: 'company-a' }, 'alice'), 'alice creates own profile');
await expectAllowed(write('companies/company-a', { users: ['alice'], name: 'A' }, 'alice'), 'alice creates own company');
await expectAllowed(write('companies/company-a/clients/client-1', { name: 'Client A' }, 'alice'), 'company member writes client');
await expectAllowed(read('companies/company-a/clients/client-1', 'alice'), 'company member reads client');

await expectAllowed(write('users/bob', { uid: 'bob', companyId: 'company-b' }, 'bob'), 'bob creates own profile');
await expectAllowed(write('companies/company-b', { users: ['bob'], name: 'B' }, 'bob'), 'bob creates own company');

await expectDenied(read('companies/company-a/clients/client-1', 'bob'), 'cross-company read is denied');
await expectDenied(write('companies/company-a/clients/client-2', { name: 'Intruder' }, 'bob'), 'cross-company write is denied');
await expectDenied(read('companies/company-a/clients/client-1'), 'unauthenticated read is denied');
await expectDenied(write('companies/company-a/clients/client-3', { name: 'Anon' }), 'unauthenticated write is denied');

await expectAllowed(write('companies/company-a/templates/invoice', { id: 'invoice', companyId: 'company-a', type: 'invoice', name: 'Default invoice template', storagePath: 'companies/company-a/templates/invoice.docx' }, 'alice'), 'member writes template');
await expectAllowed(write('companies/company-a/expenses/expense-1', {
  description: 'Hosting', tagKeys: ['client:client-1', 'project:project-1']
}, 'alice'), 'member writes tagged expense');
await expectAllowed(write('companies/company-a/clients/client-1/expenses/expense-2', {
  description: 'Design', tagKeys: ['client:client-1']
}, 'alice'), 'member writes tagged client expense');
await expectAllowed(write('companies/company-a/statementData/statement-row-1', {
  type: 'expense', values: ['Hosting', '499.00'], tagKeys: ['category:hosting']
}, 'alice'), 'member writes tagged statement data');
await expectDenied(read('companies/company-a/statementData/statement-row-1', 'bob'), 'cross-company statement data read is denied');
await expectDenied(write('companies/company-a/statementData/statement-row-2', {
  type: 'expense', tagKeys: 'category:hosting'
}, 'alice'), 'tag keys must be a list');
await expectDenied(write('companies/company-a/expenses/expense-too-many-tags', {
  description: 'Invalid', tagKeys: Array.from({ length: 51 }, (_, index) => `custom:${index}`)
}, 'alice'), 'tag keys are bounded');
await expectAllowed(write('companies/company-a/clients/client-1/invoices/invoice-1', {
  invoiceNo: 'INV-1', tagKeys: ['client:client-1', 'project:project-1']
}, 'alice'), 'member writes tagged invoice');
await expectAllowed(write('companies/company-a/invoiceSummaries/invoice-1', {
  clientId: 'client-1', invoiceNo: 'INV-1', tagKeys: ['client:client-1', 'project:project-1']
}, 'alice'), 'member writes tagged invoice summary');
await expectDenied(read('companies/company-a/invoiceSummaries/invoice-1', 'bob'), 'cross-company invoice summary read is denied');
await expectDenied(write('companies/company-a/expenses/intruder-expense', {
  description: 'Intruder', tagKeys: ['client:client-1']
}, 'bob'), 'cross-company tagged expense write is denied');
await expectDenied(write('companies/company-a/clients/client-1/invoices/intruder-invoice', {
  invoiceNo: 'INV-X', tagKeys: ['client:client-1']
}, 'bob'), 'cross-company tagged invoice write is denied');

await expectAllowed(write('companies/company-a/emailIntegration/preferences', {
  companyId: 'company-a',
  defaultProvider: 'gmail',
  onboardingCompleted: true,
  selectedSender: { displayName: 'Accounts', email: 'accounts@example.com' },
  nexusFallback: { enabled: true, replyToEmail: 'replies@example.com' },
}, 'alice'), 'company member edits email preferences');
await expectAllowed(read('companies/company-a/emailIntegration/preferences', 'alice'), 'company member reads email preferences');

await expectDenied(write('companies/company-a/emailIntegration/preferences', {
  companyId: 'company-a', defaultProvider: 'gmail', onboardingCompleted: true,
  gmail: { connected: true },
}, 'alice'), 'company member cannot add trusted flags to preferences');
await expectDenied(write('companies/company-a/emailIntegration/status', {
  gmail: { connected: true, connectedBy: 'alice' },
  sendgrid: { apiKeyConfigured: true },
}, 'alice'), 'company member cannot forge public connection status');
await expectDenied(write('companies/company-a/privateEmailTokens/gmail', {
  refreshToken: 'secret', accessToken: 'secret',
}, 'alice'), 'company member cannot write provider credentials');
await expectDenied(read('companies/company-a/privateEmailTokens/gmail', 'alice'), 'company member cannot read provider credentials');
await expectDenied(write('companies/company-a', {
  users: ['alice'], name: 'A', emailIntegrations: { gmail: { connected: true } },
}, 'alice'), 'company member cannot forge legacy embedded connection metadata');

console.log('Firestore rules tests passed');
