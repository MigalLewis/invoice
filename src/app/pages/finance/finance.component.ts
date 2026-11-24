import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { combineLatest, switchMap, take } from 'rxjs';
import { ExpensesComponent } from '../../components/expenses/expenses.component';
import { NavBarComponent } from '../../components/nav-bar/nav-bar.component';
import { WorkspaceTopbarComponent } from '../../components/workspace-topbar/workspace-topbar.component';
import { Expense } from '../../models/expense.model';
import { InvoiceRecord } from '../../models/invoice.model';
import { ClientService } from '../../services/client.service';
import { CurrencyService } from '../../services/currency.service';
import { ExpensesService } from '../../services/expenses.service';
import { CompanyContextService } from '../../services/company-context.service';
import { buildAccountantCsv, calculateMonthlyProfit, calculateVatReport } from '../../utils/finance-calculations';
import { WorkspaceShellComponent } from '../../components/workspace-shell/workspace-shell.component';
import { MetricCardComponent } from '../../components/metric-card/metric-card.component';
import { BankStatementImporterComponent } from '../../components/bank-statement-importer/bank-statement-importer.component';
import { FinanceTagPickerComponent } from '../../components/finance-tag-picker/finance-tag-picker.component';
import { createFinanceTag, FinanceTag, parseFinanceTagKey } from '../../models/finance-tag.model';
import { StatementData } from '../../models/statement-data.model';
import { StatementDataService } from '../../services/statement-data.service';
import { TagOptionsService } from '../../services/tag-options.service';
import { groupFinanceRecordsByProject, matchesFinanceTags } from '../../utils/finance-tag-filter';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, FormsModule, NavBarComponent, WorkspaceTopbarComponent, ExpensesComponent, WorkspaceShellComponent, MetricCardComponent, BankStatementImporterComponent, FinanceTagPickerComponent],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.scss'
})
export class FinanceComponent {
  private readonly router = inject(Router);
  private readonly clientsService = inject(ClientService);
  private readonly expensesService = inject(ExpensesService);
  private readonly currencyService = inject(CurrencyService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly statementDataService = inject(StatementDataService);
  private readonly tagOptionsService = inject(TagOptionsService);

  companyId = signal('');
  selectedMonth = signal(this.toMonthKey(new Date()));
  currency = signal(this.currencyService.defaultCurrency);
  invoices = signal<InvoiceRecord[]>([]);
  expenses = signal<Expense[]>([]);
  statementRows = signal<StatementData[]>([]);
  loading = signal(true);
  activeWorkspace = signal<'expenses' | 'statements'>('expenses');
  selectedFilterTags = signal<FinanceTag[]>([]);
  projectLabels = signal<Record<string, string>>({});

  filterTagKeys = computed(() => this.selectedFilterTags().map(tag => tag.key));
  filteredInvoices = computed(() => this.invoices().filter(invoice => matchesFinanceTags(invoice, this.filterTagKeys())));
  filteredExpenses = computed(() => this.expenses().filter(expense => matchesFinanceTags(expense, this.filterTagKeys())));
  filteredStatementRows = computed(() => this.statementRows().filter(row => matchesFinanceTags(row, this.filterTagKeys())));
  profitSummary = computed(() => calculateMonthlyProfit(this.filteredInvoices(), this.filteredExpenses(), this.selectedMonth()));
  vatReport = computed(() => calculateVatReport(this.filteredInvoices(), this.filteredExpenses(), this.selectedMonth()));
  matchingRecordCount = computed(() =>
    this.filteredInvoices().length + this.filteredExpenses().length + this.filteredStatementRows().length
  );
  availableCustomTags = computed(() => {
    const keys = [
      ...this.invoices().flatMap(record => record.tagKeys ?? []),
      ...this.expenses().flatMap(record => record.tagKeys ?? []),
      ...this.statementRows().flatMap(record => record.tagKeys ?? [])
    ];
    const customValues = new Set(keys
      .map(key => parseFinanceTagKey(key))
      .filter(parsed => parsed?.type === 'custom')
      .map(parsed => parsed!.value));
    return [...customValues].map(value => createFinanceTag(
      'custom',
      value.replace(/[-_]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()),
      value
    ));
  });
  projectGroups = computed(() => groupFinanceRecordsByProject(
    this.filteredInvoices(),
    this.filteredExpenses(),
    this.filteredStatementRows(),
    key => this.projectLabels()[key] || key.slice('project:'.length)
  ));

  constructor() {
    this.companyContext.currentContext$().subscribe({
      next: ctx => {
        this.companyId.set(ctx.companyId);
        this.companyContext.currentCompany$().subscribe((company: any) => {
          this.currency.set(this.currencyService.normalize(company?.currency));
        });
        this.loadMonth(this.selectedMonth());
      },
      error: err => {
        this.router.navigate([err?.message === 'Not authenticated' ? '/login' : '/register']);
      }
    });
    this.tagOptionsService.options$().subscribe(groups => {
      const labels = groups
        .find(group => group.type === 'project')?.options
        .reduce<Record<string, string>>((result, tag) => ({ ...result, [tag.key]: tag.label }), {}) ?? {};
      this.projectLabels.set(labels);
    });
  }

  onMonthChange(month: string) {
    this.selectedMonth.set(month);
    this.loadMonth(month);
  }

  exportCsv() {
    const csv = buildAccountantCsv(this.selectedMonth(), this.filteredInvoices(), this.filteredExpenses());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `accountant-handoff-${this.selectedMonth()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  format(value: number) {
    return this.currencyService.format(value, this.currency());
  }

  clearTagFilters() {
    this.selectedFilterTags.set([]);
  }

  private loadMonth(_month: string) {
    const companyId = this.companyId();
    if (!companyId) return;
    this.loading.set(true);
    combineLatest([
      this.clientsService.getInvoicesForCompany(),
      this.clientsService.clients$().pipe(
        switchMap(clients => this.expensesService.listAllIncludingClients(companyId, clients.map(client => client.id)))
      ),
      this.statementDataService.list(companyId)
    ]).pipe(take(1)).subscribe(([invoices, expenses, statementRows]) => {
      this.expenses.set(expenses);
      this.invoices.set(invoices);
      this.statementRows.set(statementRows);
      this.loading.set(false);
    });
  }

  private toMonthKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
