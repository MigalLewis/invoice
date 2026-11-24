export interface BankStatementResponse { accountNumber?: string; accountName?: string; branchNumber?: string; branchName?: string; rows: string[][]; }
export type ExportFormat = 'CSV' | 'EXCEL';