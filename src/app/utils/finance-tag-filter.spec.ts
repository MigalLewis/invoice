import { Expense } from '../models/expense.model';
import { InvoiceRecord } from '../models/invoice.model';
import { StatementData } from '../models/statement-data.model';
import { effectiveFinanceTagKeys, expenseCategoryTagKey, groupFinanceRecordsByProject, matchesFinanceTags } from './finance-tag-filter';

describe('finance tag filtering', () => {
  it('maps explicit expense categories to filterable category tags', () => {
    expect(expenseCategoryTagKey('Fuel / Travel')).toBe('category:travel');
    expect(expenseCategoryTagKey('Software / Subscriptions')).toBe('category:software');
    expect(effectiveFinanceTagKeys({ category: 'Rent' })).toContain('category:rent');
    expect(effectiveFinanceTagKeys({ category: 'Rent', tagKeys: ['category:other'] })).toEqual(['category:other']);
  });
  it('includes structured client and project relationships for legacy records', () => {
    expect(effectiveFinanceTagKeys({
      clientId: 'client-1',
      projectId: 'project-1',
      tagKeys: ['vat:claimable']
    })).toEqual(['vat:claimable', 'client:client-1', 'project:project-1']);
  });

  it('matches every selected tag', () => {
    const record = { tagKeys: ['project:project-1', 'vat:claimable'] as const };
    expect(matchesFinanceTags(record, ['project:project-1'])).toBeTrue();
    expect(matchesFinanceTags(record, ['project:project-1', 'vat:claimable'])).toBeTrue();
    expect(matchesFinanceTags(record, ['project:project-1', 'status:reconciled'])).toBeFalse();
  });

  it('groups invoices, expenses, and statements by project', () => {
    const invoices = [{ total: 1000, amountPaid: 1000, status: 'paid', projectId: 'project-1' }] as InvoiceRecord[];
    const expenses = [{ id: 'expense-1', month: '2026-11', date: '2026-11-01', description: 'Hosting', category: 'Software', amount: 250, tagKeys: ['project:project-1'] }] as Expense[];
    const statements = [{ id: 'row-1', type: 'expense', bankType: 'FNB', bankName: 'FNB', sourceFileName: 'statement.pdf', headers: [], values: [], statementRowIndex: 1, tagKeys: [] }] as StatementData[];

    expect(groupFinanceRecordsByProject(invoices, expenses, statements, () => 'Website')).toEqual([
      {
        key: 'project:project-1', label: 'Website', invoiceCount: 1, invoiceTotal: 1000,
        expenseCount: 1, expenseTotal: 250, statementCount: 0, recordCount: 2, net: 750
      },
      {
        key: 'unassigned', label: 'Unassigned', invoiceCount: 0, invoiceTotal: 0,
        expenseCount: 0, expenseTotal: 0, statementCount: 1, recordCount: 1, net: 0
      }
    ]);
  });
});
