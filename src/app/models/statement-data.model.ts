import { BankStatementType } from './bank.model';
import { FinanceTagKey } from './finance-tag.model';

export type StatementDataType =
  | 'expense'
  | 'paid_invoice'
  | 'income'
  | 'bank_fee'
  | 'transfer'
  | 'other';

export interface CreateStatementData {
  type: StatementDataType;
  bankType: BankStatementType;
  bankName: string;
  sourceFileName: string;
  accountNumber?: string;
  accountName?: string;
  branchNumber?: string;
  branchName?: string;
  headers: string[];
  values: string[];
  statementRowIndex: number;
  tagKeys: FinanceTagKey[];
}

export interface StatementData extends CreateStatementData {
  id: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
