import { Expense } from '../models/expense.model';
import { FinanceTagKey, normalizeFinanceTagKeys, parseFinanceTagKey } from '../models/finance-tag.model';
import { InvoiceRecord, InvoiceSummaryRecord } from '../models/invoice.model';
import { StatementData } from '../models/statement-data.model';

export interface ProjectFinanceGroup {
  key: FinanceTagKey | 'unassigned';
  label: string;
  invoiceCount: number;
  invoiceTotal: number;
  expenseCount: number;
  expenseTotal: number;
  statementCount: number;
  recordCount: number;
  net: number;
}

type TaggableRecord = {
  tagKeys?: readonly FinanceTagKey[];
  clientId?: string | null;
  projectId?: string | null;
};

export function effectiveFinanceTagKeys(record: TaggableRecord): FinanceTagKey[] {
  return normalizeFinanceTagKeys([
    ...(record.tagKeys ?? []),
    ...(record.clientId ? [`client:${record.clientId}`] : []),
    ...(record.projectId ? [`project:${record.projectId}`] : [])
  ]);
}

export function matchesFinanceTags(record: TaggableRecord, selectedKeys: readonly FinanceTagKey[]): boolean {
  if (selectedKeys.length === 0) return true;
  const recordKeys = new Set(effectiveFinanceTagKeys(record));
  return selectedKeys.every(key => recordKeys.has(key));
}

export function groupFinanceRecordsByProject(
  invoices: readonly InvoiceRecord[],
  expenses: readonly Expense[],
  statements: readonly StatementData[],
  projectLabel: (key: FinanceTagKey) => string
): ProjectFinanceGroup[] {
  const groups = new Map<FinanceTagKey | 'unassigned', ProjectFinanceGroup>();
  const groupFor = (record: TaggableRecord) => {
    const projectKey = effectiveFinanceTagKeys(record).find(key => parseFinanceTagKey(key)?.type === 'project') ?? 'unassigned';
    let group = groups.get(projectKey);
    if (!group) {
      group = {
        key: projectKey,
        label: projectKey === 'unassigned' ? 'Unassigned' : projectLabel(projectKey),
        invoiceCount: 0,
        invoiceTotal: 0,
        expenseCount: 0,
        expenseTotal: 0,
        statementCount: 0,
        recordCount: 0,
        net: 0
      };
      groups.set(projectKey, group);
    }
    return group;
  };

  invoices.forEach(invoice => {
    const group = groupFor(invoice as InvoiceRecord & Partial<InvoiceSummaryRecord>);
    group.invoiceCount += 1;
    group.invoiceTotal += Number(invoice.total) || 0;
    group.recordCount += 1;
  });
  expenses.forEach(expense => {
    const group = groupFor(expense);
    group.expenseCount += 1;
    group.expenseTotal += Number(expense.amount) || 0;
    group.recordCount += 1;
  });
  statements.forEach(statement => {
    const group = groupFor(statement);
    group.statementCount += 1;
    group.recordCount += 1;
  });

  return [...groups.values()]
    .map(group => ({ ...group, net: group.invoiceTotal - group.expenseTotal }))
    .sort((left, right) => {
      if (left.key === 'unassigned') return 1;
      if (right.key === 'unassigned') return -1;
      return left.label.localeCompare(right.label);
    });
}
