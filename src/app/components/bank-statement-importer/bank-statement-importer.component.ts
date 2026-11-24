import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, OnDestroy, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { of, switchMap } from 'rxjs';
import { FinanceTagPickerComponent } from '../finance-tag-picker/finance-tag-picker.component';
import { StatementDataTagEditorComponent } from '../statement-data-tag-editor/statement-data-tag-editor.component';
import { BankStatementResponse, ExportFormat } from '../../models/bank-statement-response.model';
import { BankOption } from '../../models/bank.model';
import { FinanceTag, FinanceTagKey } from '../../models/finance-tag.model';
import { matchesFinanceTags } from '../../utils/finance-tag-filter';
import { CreateStatementData, StatementDataType } from '../../models/statement-data.model';
import { BankStatementApiService } from '../../services/bank-statement-api.service';
import { StatementDataService } from '../../services/statement-data.service';

@Component({
  selector: 'app-bank-statement-importer',
  standalone: true,
  imports: [CommonModule, FinanceTagPickerComponent, StatementDataTagEditorComponent],
  templateUrl: './bank-statement-importer.component.html',
  styleUrl: './bank-statement-importer.component.scss'
})
export class BankStatementImporterComponent implements OnDestroy {
  private readonly api = inject(BankStatementApiService);
  private readonly statementDataService = inject(StatementDataService);
  private readonly sanitizer = inject(DomSanitizer);
  private rawPdfObjectUrl: string | null = null;

  companyId = input<string>('');
  filterTagKeys = input<readonly FinanceTagKey[]>([]);

  readonly statementTypes: ReadonlyArray<{ value: StatementDataType; label: string }> = [
    { value: 'expense', label: 'Expense' },
    { value: 'paid_invoice', label: 'Paid invoice' },
    { value: 'income', label: 'Other income' },
    { value: 'bank_fee', label: 'Bank fee' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'other', label: 'Other' }
  ];

  readonly banks: BankOption[] = [
    {
      type: 'STANDARD_BANK',
      name: 'Standard Bank',
      shortName: 'SB',
      description: 'Extract account, branch and transaction details.',
      accent: 'linear-gradient(135deg, #0033a1, #00a3e0)'
    },
    {
      type: 'FNB',
      name: 'FNB',
      shortName: 'FNB',
      description: 'Convert FNB statement transactions into table data.',
      accent: 'linear-gradient(135deg, #003c3c, #00aaad)'
    },
    {
      type: 'CAPITEC',
      name: 'Capitec',
      shortName: 'CAP',
      description: 'Convert Capitec statement transactions into table data.',
      accent: 'linear-gradient(135deg, #102a83, #d71920)'
    },
    {
      type: 'ABSA',
      name: 'ABSA',
      shortName: 'AB',
      description: 'Convert ABSA statement transactions into table data.',
      accent: 'linear-gradient(135deg, #a70d2a, #e31837)'
    },
    {
      type: 'NEDBANK',
      name: 'Nedbank',
      shortName: 'NB',
      description: 'Convert Nedbank statement transactions into table data.',
      accent: 'linear-gradient(135deg, #004b23, #00a651)'
    }
  ];

  selectedBank = signal<BankOption | null>(null);
  selectedFile = signal<File | null>(null);
  pdfUrl = signal<SafeResourceUrl | null>(null);
  result = signal<BankStatementResponse | null>(null);
  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  selectedRows = signal<Set<number>>(new Set<number>());
  selectedType = signal<StatementDataType>('expense');
  selectedTags = signal<FinanceTag[]>([]);
  savedRows = toSignal(
    toObservable(this.companyId).pipe(
      switchMap(companyId => companyId ? this.statementDataService.list(companyId) : of([]))
    ),
    { initialValue: [] }
  );
  visibleSavedRows = computed(() =>
    this.savedRows().filter(record => matchesFinanceTags(record, this.filterTagKeys()))
  );

  get headers(): string[] {
    return this.result()?.rows?.[0] ?? [];
  }

  get bodyRows(): string[][] {
    return this.result()?.rows?.slice(1) ?? [];
  }

  get allRowsSelected(): boolean {
    return this.bodyRows.length > 0 && this.selectedRows().size === this.bodyRows.length;
  }

  ngOnDestroy(): void {
    this.revokeCurrentPdfUrl();
  }

  selectBank(bank: BankOption): void {
    this.selectedBank.set(bank);
    this.result.set(null);
    this.selectedRows.set(new Set<number>());
    this.selectedTags.set([]);
    this.clearStatus();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.error.set('Please upload a PDF file.');
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
    this.result.set(null);
    this.selectedRows.set(new Set<number>());
    this.selectedTags.set([]);
    this.clearStatus();
    this.updatePdfPreview(file);
  }

  rotatePdf(): void {
    const file = this.selectedFile();
    if (!file) {
      this.error.set('Please select a PDF first.');
      return;
    }

    this.startRequest();
    this.api.rotatePdf(file, 90).subscribe({
      next: blob => {
        const rotatedFile = new File([blob], this.buildRotatedFileName(file.name), { type: 'application/pdf' });
        this.selectedFile.set(rotatedFile);
        this.updatePdfPreview(rotatedFile);
        this.message.set('PDF rotated successfully.');
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The PDF could not be rotated. Check the statement service and try again.');
        this.loading.set(false);
      }
    });
  }

  extractStatement(): void {
    const bank = this.selectedBank();
    const file = this.selectedFile();
    if (!bank) {
      this.error.set('Please select a bank first.');
      return;
    }
    if (!file) {
      this.error.set('Please upload a PDF statement first.');
      return;
    }

    this.startRequest();
    this.result.set(null);
    this.api.extractStatement(file, bank.type).subscribe({
      next: response => {
        this.result.set(response);
        this.selectedRows.set(new Set<number>());
        this.selectedTags.set([]);
        this.message.set('Statement extracted successfully.');
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The statement could not be extracted. Check the selected bank and try again.');
        this.loading.set(false);
      }
    });
  }

  downloadExport(format: ExportFormat): void {
    const bank = this.selectedBank();
    const file = this.selectedFile();
    if (!bank || !file) {
      this.error.set('Select a bank and upload a statement before exporting.');
      return;
    }

    this.startRequest();
    this.api.exportStatement(file, bank.type, format).subscribe({
      next: blob => {
        const extension = format === 'CSV' ? 'csv' : 'xlsx';
        const bankName = bank.name.toLowerCase().replace(/\s+/g, '-');
        this.downloadBlob(blob, `${bankName}-statement.${extension}`);
        this.message.set(`${format === 'CSV' ? 'CSV' : 'Excel'} downloaded successfully.`);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(`The ${format === 'CSV' ? 'CSV' : 'Excel'} file could not be downloaded. Try again.`);
        this.loading.set(false);
      }
    });
  }

  toggleRow(index: number, checked: boolean): void {
    const selected = new Set(this.selectedRows());
    checked ? selected.add(index) : selected.delete(index);
    this.selectedRows.set(selected);
  }

  toggleAllRows(checked: boolean): void {
    this.selectedRows.set(checked
      ? new Set(this.bodyRows.map((_row, index) => index))
      : new Set<number>());
  }

  setStatementType(value: string): void {
    const option = this.statementTypes.find(type => type.value === value);
    if (option) this.selectedType.set(option.value);
  }

  async saveSelectedRows(): Promise<void> {
    const companyId = this.companyId();
    const bank = this.selectedBank();
    const file = this.selectedFile();
    const result = this.result();
    const selectedIndexes = [...this.selectedRows()].sort((a, b) => a - b);

    if (!companyId || !bank || !file || !result) {
      this.error.set('The statement context is incomplete. Refresh the page and try again.');
      return;
    }
    if (!selectedIndexes.length) {
      this.error.set('Select at least one statement row to add.');
      return;
    }

    const rows: CreateStatementData[] = selectedIndexes.map(index => ({
      type: this.selectedType(),
      bankType: bank.type,
      bankName: bank.name,
      sourceFileName: file.name,
      ...(result.accountNumber ? { accountNumber: result.accountNumber } : {}),
      ...(result.accountName ? { accountName: result.accountName } : {}),
      ...(result.branchNumber ? { branchNumber: result.branchNumber } : {}),
      ...(result.branchName ? { branchName: result.branchName } : {}),
      headers: [...this.headers],
      values: [...this.bodyRows[index]],
      statementRowIndex: index + 1,
      tagKeys: this.selectedTags().map(tag => tag.key)
    }));

    this.saving.set(true);
    this.clearStatus();
    try {
      await this.statementDataService.addMany(companyId, rows);
      this.selectedRows.set(new Set<number>());
      this.message.set(`${rows.length} statement row${rows.length === 1 ? '' : 's'} added as ${this.selectedTypeLabel().toLowerCase()}.`);
    } catch {
      this.error.set('The selected statement rows could not be saved. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  reset(fileInput?: HTMLInputElement): void {
    this.selectedFile.set(null);
    this.result.set(null);
    this.selectedRows.set(new Set<number>());
    this.selectedTags.set([]);
    this.pdfUrl.set(null);
    this.clearStatus();
    this.revokeCurrentPdfUrl();
    if (fileInput) fileInput.value = '';
  }

  private startRequest(): void {
    this.loading.set(true);
    this.clearStatus();
  }

  private selectedTypeLabel(): string {
    return this.statementTypes.find(type => type.value === this.selectedType())?.label ?? 'statement data';
  }

  private clearStatus(): void {
    this.message.set('');
    this.error.set('');
  }

  private updatePdfPreview(file: File): void {
    this.revokeCurrentPdfUrl();
    this.rawPdfObjectUrl = URL.createObjectURL(file);
    this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.rawPdfObjectUrl));
  }

  private revokeCurrentPdfUrl(): void {
    if (!this.rawPdfObjectUrl) return;
    URL.revokeObjectURL(this.rawPdfObjectUrl);
    this.rawPdfObjectUrl = null;
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private buildRotatedFileName(fileName: string): string {
    return fileName.toLowerCase().endsWith('.pdf')
      ? fileName.replace(/\.pdf$/i, '-rotated.pdf')
      : `${fileName}-rotated.pdf`;
  }
}
