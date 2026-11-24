import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BankStatementResponse, ExportFormat } from '../models/bank-statement-response.model';
import { BankStatementType } from '../models/bank.model';
import { AppConfigService } from './app-config.service';

@Injectable({ providedIn: 'root' })
export class BankStatementApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(AppConfigService).config.apiBaseUrl;

  rotatePdf(file: File, degrees: number): Observable<Blob> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('degrees', String(degrees));

    return this.http.post(`${this.apiBaseUrl}/api/pdf/rotate`, formData, { responseType: 'blob' });
  }

  extractStatement(file: File, type: BankStatementType): Observable<BankStatementResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return this.http.post<BankStatementResponse>(`${this.apiBaseUrl}/api/statements/extract`, formData);
  }

  exportStatement(
    file: File,
    type: BankStatementType,
    format: ExportFormat
  ): Observable<Blob> {
    const formData = new FormData();

    formData.append('file', file);
    formData.append('type', type);
    formData.append('format', format);

    return this.http.post(`${this.apiBaseUrl}/api/statements/export`, formData, {
      responseType: 'blob'
    });
  }
}
