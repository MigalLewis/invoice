import { BankStatementType } from './bank.model';

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
}

export interface StatementData extends CreateStatementData {
  id: string;
  createdAt?: unknown;
}
