import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BankStatementResponse, ExportFormat } from '../../models/bank-statement-response.model';
import { BankOption } from '../../models/bank.model';
import { BankStatementApiService } from '../../services/bank-statement-api.service';

@Component({
  selector: 'app-bank-statement-importer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bank-statement-importer.component.html',
  styleUrl: './bank-statement-importer.component.scss'
})
export class BankStatementImporterComponent implements OnDestroy {
  private readonly api = inject(BankStatementApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private rawPdfObjectUrl: string | null = null;

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
  message = signal('');
  error = signal('');

  get headers(): string[] {
    return this.result()?.rows?.[0] ?? [];
  }

  get bodyRows(): string[][] {
    return this.result()?.rows?.slice(1) ?? [];
  }

  ngOnDestroy(): void {
    this.revokeCurrentPdfUrl();
  }

  selectBank(bank: BankOption): void {
    this.selectedBank.set(bank);
    this.result.set(null);
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

  reset(fileInput?: HTMLInputElement): void {
    this.selectedFile.set(null);
    this.result.set(null);
    this.pdfUrl.set(null);
    this.clearStatus();
    this.revokeCurrentPdfUrl();
    if (fileInput) fileInput.value = '';
  }

  private startRequest(): void {
    this.loading.set(true);
    this.clearStatus();
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
