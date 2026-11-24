import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ExpensesComponent } from '../../components/expenses/expenses.component';
import { CompanyContextService } from '../../services/company-context.service';
import { WorkspaceShellComponent } from '../../components/workspace-shell/workspace-shell.component';
import { BankStatementImporterComponent } from '../../components/bank-statement-importer/bank-statement-importer.component';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, ExpensesComponent, WorkspaceShellComponent, BankStatementImporterComponent],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.scss'
})
export class FinanceComponent {
  private readonly router = inject(Router);
  private readonly companyContext = inject(CompanyContextService);

  companyId = signal('');
  activeWorkspace = signal<'expenses' | 'statements'>('expenses');

  constructor() {
    this.companyContext.currentContext$().subscribe({
      next: ctx => {
        this.companyId.set(ctx.companyId);
      },
      error: err => {
        this.router.navigate([err?.message === 'Not authenticated' ? '/login' : '/register']);
      }
    });
  }
}
