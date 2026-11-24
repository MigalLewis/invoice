import { Component, computed, inject, signal } from '@angular/core';
import { NavBarComponent } from '../../components/nav-bar/nav-bar.component';
import { WorkspaceTopbarComponent } from '../../components/workspace-topbar/workspace-topbar.component';
import { doc, docData, Firestore, updateDoc } from '@angular/fire/firestore';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, Observable, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { UploadTemplateDialogueComponent } from '../../components/upload-template-dialogue/upload-template-dialogue.component';
import { LinkFolderDialogueComponent } from '../../components/link-folder-dialogue/link-folder-dialogue.component';
import { CurrencyService } from '../../services/currency.service';
import { ClientService } from '../../services/client.service';
import { ExpensesService } from '../../services/expenses.service';
import { Expense } from '../../models/expense.model';
import { ActivityRecord } from '../../models/activity.model';
import { ActivityService } from '../../services/activity.service';
import { CompanyContextService } from '../../services/company-context.service';
import { AppUser, InvoiceRecord, InvoiceStatus } from '../../models/invoice.model';
import { WorkspaceShellComponent } from '../../components/workspace-shell/workspace-shell.component';
import { MetricCardComponent } from '../../components/metric-card/metric-card.component';
import { LoadingStateComponent } from '../../components/loading-state/loading-state.component';
import { FinanceTagPickerComponent } from '../../components/finance-tag-picker/finance-tag-picker.component';
import { createFinanceTag, FinanceTag, parseFinanceTagKey } from '../../models/finance-tag.model';
import { matchesFinanceTags } from '../../utils/finance-tag-filter';

type DashboardPeriod = 'last30' | 'thisMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'custom';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [NavBarComponent, WorkspaceTopbarComponent, CommonModule, FormsModule, RouterLink, WorkspaceShellComponent, MetricCardComponent, LoadingStateComponent, FinanceTagPickerComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  private db = inject(Firestore);
  private router = inject(Router);
  private dialog = inject(Dialog);
  private currencyService = inject(CurrencyService);
  private clientService = inject(ClientService);
  private expensesService = inject(ExpensesService);
  private activityService = inject(ActivityService);
  private companyContext = inject(CompanyContextService);

  companyId = signal<string >("");
  companyName = signal<string | null>(null);
  templatePath = signal<string | null>(null);
  currency = signal(this.currencyService.defaultCurrency);
  currencySymbol = computed(() => this.currencyService.symbolFor(this.currency()));
  invoices = signal<InvoiceRecord[]>([]);
  expenses = signal<Expense[]>([]);
  activities = signal<ActivityRecord[]>([]);
  signedInUserName = signal('Workspace User');
  signedInUserRole = signal('Team Member');
  signedInUserInitials = computed(() => this.initialsFor(this.signedInUserName()));
  selectedFilterTags = signal<FinanceTag[]>([]);
  selectedPeriod = signal<DashboardPeriod>('last6Months');
  dateFrom = signal('');
  dateTo = signal('');

  filterTagKeys = computed(() => this.selectedFilterTags().map(tag => tag.key));
  tagFilteredInvoices = computed(() => this.invoices().filter(invoice => matchesFinanceTags(invoice, this.filterTagKeys())));
  tagFilteredExpenses = computed(() => this.expenses().filter(expense => matchesFinanceTags(expense, this.filterTagKeys())));
  filteredRevenueInvoices = computed(() => this.tagFilteredInvoices().filter(invoice =>
    this.isWithinSelectedPeriod(invoice.paidAt || invoice.date || invoice.createdAt || invoice.dueDate)
  ));
  filteredOutstandingInvoices = computed(() => this.tagFilteredInvoices().filter(invoice =>
    this.isWithinSelectedPeriod(invoice.date || invoice.createdAt || invoice.dueDate)
  ));
  filteredExpenses = computed(() => this.tagFilteredExpenses().filter(expense =>
    this.isWithinSelectedPeriod(expense.date || expense.createdAt)
  ));
  availableCustomTags = computed(() => {
    const customValues = new Set([
      ...this.invoices().flatMap(record => record.tagKeys ?? []),
      ...this.expenses().flatMap(record => record.tagKeys ?? [])
    ].map(key => parseFinanceTagKey(key))
      .filter(parsed => parsed?.type === 'custom')
      .map(parsed => parsed!.value));
    return [...customValues].map(value => createFinanceTag(
      'custom',
      value.replace(/[-_]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()),
      value
    ));
  });
  outstanding = computed(() => this.filteredOutstandingInvoices().reduce((sum, invoice) => {
    if (this.normalizedInvoiceStatus(invoice) === 'draft') return sum;
    return sum + this.invoiceOutstanding(invoice);
  }, 0));

  revenue = computed(() => this.filteredRevenueInvoices().reduce((sum, invoice) => {
    if (this.normalizedInvoiceStatus(invoice) === 'draft') return sum;
    return sum + this.invoiceRevenue(invoice);
  }, 0));

  expenseTotal = computed(() => this.filteredExpenses().reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0));
  netProfit = computed(() => this.revenue() - this.expenseTotal());

  loading = signal(true);

  chartMonths = computed(() => {
    const months = this.monthsInSelectedPeriod();
    const rows = months.map(month => {
      const incomeTotal = this.filteredRevenueInvoices()
        .filter(invoice => this.invoiceMonthKey(invoice) === month.key)
        .reduce((sum, invoice) => sum + this.invoiceRevenue(invoice), 0);
      const expenseTotal = this.filteredExpenses()
        .filter(expense => this.expenseMonthKey(expense) === month.key)
        .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

      return {
        ...month,
        incomeTotal,
        expenseTotal
      };
    });
    const maxAmount = Math.max(1, ...rows.flatMap(month => [month.incomeTotal, month.expenseTotal]));

    return rows.map(month => ({
      ...month,
      income: this.toChartHeight(month.incomeTotal, maxAmount),
      expenses: this.toChartHeight(month.expenseTotal, maxAmount)
    }));
  });

  upcomingPayments = computed(() => {
    const today = this.startOfToday();

    return this.invoices()
      .map(invoice => ({
        invoice,
        dueDate: this.dateFromValue(invoice.dueDate),
        outstanding: this.invoiceOutstanding(invoice),
        status: this.normalizedInvoiceStatus(invoice),
      }))
      .filter(item => item.dueDate && item.dueDate >= today && item.outstanding > 0 && item.status !== 'draft' && item.status !== 'paid')
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .slice(0, 5)
      .map(item => ({
        name: item.invoice.invoiceNumber || item.invoice.filename || 'Invoice payment',
        meta: `${this.invoiceStatusLabel(item.status)} · ${this.formatDueDate(item.dueDate!)}`,
        amount: item.outstanding,
        icon: item.status === 'overdue' ? '⚠️' : '📅',
        tone: item.status === 'partial' ? 'green' : 'red',
      }));
  });

  activityItems = computed(() => this.activities().map(activity => ({
    ...activity,
    title: this.activityTitle(activity),
    time: this.formatActivityDate(activity.createdAt),
    icon: this.activityIcon(activity.changeType),
    tone: this.activityTone(activity.changeType),
  })));


  constructor() {
    this.applyPeriod('last6Months');
    this.companyContext.currentContext$().subscribe({
      next: ({ user, profile, companyId }) => {
        this.setSignedInUser(user, profile);
        this.companyId.set(companyId);
        const compRef = doc(this.db, `companies/${companyId}`);
        docData(compRef).subscribe((data: any) => {
          this.companyName.set(data?.name ?? 'Your Company');
          this.currency.set(this.currencyService.normalize(data?.currency));
        });

        docData(doc(this.db, `companies/${companyId}/templates/invoice`)).subscribe((template: any) => {
          this.templatePath.set(template?.storagePath ?? null);
        });

        this.activityService.recent(companyId).subscribe(activities => {
          this.activities.set(activities);
        });

        combineLatest([
          this.clientService.getInvoicesForCompany(),
          this.allExpensesForCompany(companyId)
        ]).subscribe(([invoices, expenses]) => {
          this.invoices.set(invoices);
          this.expenses.set(expenses);
          this.loading.set(false);
        });
      },
      error: err => {
        this.router.navigate([err?.message === 'Not authenticated' ? '/login' : '/register']);
      }
    });
  }

  applyPeriod(period: DashboardPeriod): void {
    this.selectedPeriod.set(period);
    if (period === 'custom') return;

    const today = this.startOfToday();
    let start: Date;
    switch (period) {
      case 'last30':
        start = new Date(today);
        start.setDate(start.getDate() - 29);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last3Months':
        start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    }
    this.dateFrom.set(this.toDateInputValue(start));
    this.dateTo.set(this.toDateInputValue(today));
  }

  updateCustomDate(boundary: 'from' | 'to', value: string): void {
    this.selectedPeriod.set('custom');
    if (boundary === 'from') this.dateFrom.set(value);
    else this.dateTo.set(value);
  }

  clearDashboardFilters(): void {
    this.selectedFilterTags.set([]);
    this.applyPeriod('last6Months');
  }

  private allExpensesForCompany(companyId: string): Observable<Expense[]> {
    return this.clientService.clients$().pipe(
      switchMap(clients => this.expensesService.listAllIncludingClients(companyId, clients.map(client => client.id)))
    );
  }

  goToUpload() {
    this.router.navigate(['/template']);
  }


  openUploadTemplate() {
    const ref = this.dialog.open<string | null>(UploadTemplateDialogueComponent, {
      hasBackdrop: true,
      disableClose: true,
      backdropClass: 'dlg-backdrop',
      panelClass: 'dlg-panel',
    });

    ref.closed.subscribe(path => {
      if (path) {
        // optional: toast “Template updated ✓”
        // You already subscribe to the company doc, so UI should reflect automatically.
      }
    });
  }

  private setSignedInUser(user: { displayName: string | null; email: string | null; }, profile?: AppUser): void {
    const displayName = user.displayName || profile?.email || user.email || 'Workspace User';
    this.signedInUserName.set(displayName);
    this.signedInUserRole.set(this.roleLabel(profile?.role));
  }

  private roleLabel(role?: AppUser['role']): string {
    if (!role) return 'Team Member';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  private initialsFor(name: string): string {
    const source = name.includes('@') ? name.split('@')[0] : name;
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    const initials = parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
    return initials || 'WU';
  }

  private invoiceStatusLabel(status: InvoiceStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  private formatDueDate(dueDate: Date): string {
    const today = this.startOfToday();
    const due = this.startOfDay(dueDate);
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  }

  private isPastDue(value: any): boolean {
    const date = this.dateFromValue(value);
    return !!date && this.startOfDay(date) < this.startOfToday();
  }

  private dateFromValue(value: any): Date | null {
    if (!value) return null;
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private startOfToday(): Date {
    return this.startOfDay(new Date());
  }

  private startOfDay(date: Date): Date {
    const clone = new Date(date);
    clone.setHours(0, 0, 0, 0);
    return clone;
  }


  private invoiceOutstanding(invoice: InvoiceRecord): number {
    const total = Number(invoice.total) || 0;
    const amountPaid = Number(invoice.amountPaid) || 0;
    return Math.max(0, +(total - amountPaid).toFixed(2));
  }

  private invoiceRevenue(invoice: InvoiceRecord): number {
    const total = Number(invoice.total) || 0;
    const amountPaid = Number(invoice.amountPaid) || 0;
    if (amountPaid > 0) return Math.min(amountPaid, total || amountPaid);
    return invoice.status === 'paid' ? total : 0;
  }

  private normalizedInvoiceStatus(invoice: InvoiceRecord): InvoiceStatus {
    if (invoice.status === 'draft') return 'draft';
    const total = Number(invoice.total) || 0;
    const amountPaid = Number(invoice.amountPaid) || 0;
    if (total > 0 && amountPaid >= total) return 'paid';
    if (this.isPastDue(invoice.dueDate) && this.invoiceOutstanding(invoice) > 0) return 'overdue';
    if (amountPaid > 0) return 'partial';
    return invoice.status || 'sent';
  }


  private invoiceMonthKey(invoice: InvoiceRecord): string | null {
    return this.monthKeyFromValue(invoice.paidAt || invoice.date || invoice.createdAt || invoice.dueDate);
  }

  private expenseMonthKey(expense: Expense): string | null {
    if (expense.month) return expense.month;
    return this.monthKeyFromValue(expense.date || expense.createdAt);
  }

  private monthsInSelectedPeriod() {
    const formatter = new Intl.DateTimeFormat('en', { month: 'short' });
    const start = this.dateFromValue(this.dateFrom()) ?? new Date();
    const end = this.dateFromValue(this.dateTo()) ?? start;
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const finalMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    const months = [];
    while (cursor <= finalMonth && months.length < 24) {
      months.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        label: formatter.format(cursor)
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }

  private isWithinSelectedPeriod(value: any): boolean {
    const valueDate = this.dateFromValue(value);
    const start = this.dateFromValue(this.dateFrom());
    const end = this.dateFromValue(this.dateTo());
    if (!valueDate || !start || !end) return false;
    const timestamp = this.startOfDay(valueDate).getTime();
    return timestamp >= this.startOfDay(start).getTime() && timestamp <= this.startOfDay(end).getTime();
  }

  private toDateInputValue(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private monthKeyFromValue(value: any): string | null {
    if (!value) return null;
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private toChartHeight(amount: number, maxAmount: number): number {
    if (amount <= 0) return 0;
    return Math.max(4, Math.round((amount / maxAmount) * 100));
  }
  private activityTitle(activity: ActivityRecord): string {
    const type = activity.changeType.charAt(0).toUpperCase() + activity.changeType.slice(1);
    return `${type} by ${activity.actorName}`;
  }

  private activityIcon(changeType: ActivityRecord['changeType']): string {
    switch (changeType) {
      case 'create': return '✓';
      case 'delete': return '🗑️';
      default: return '↻';
    }
  }

  private activityTone(changeType: ActivityRecord['changeType']): 'navy' | 'light' | 'brown' {
    switch (changeType) {
      case 'create': return 'light';
      case 'delete': return 'brown';
      default: return 'navy';
    }
  }

  private formatActivityDate(value: any): string {
    if (!value) return 'Just now';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }


  openLinkFolderDialog() {
    const ref = this.dialog.open(LinkFolderDialogueComponent, {
      backdropClass: 'dlg-backdrop',
      panelClass: 'dlg-panel',
      disableClose: true
    });

    ref.closed.subscribe((result => {
      const typedResult = result as { provider: 'local' | null; path: string | null; } | null;
      if (typedResult) {
        const companyId = this.companyId();
        if (!companyId) return;
        const companyRef = doc(this.db, `companies/${companyId}`);
        this.activityService.track(
          companyId,
          'update',
          `companies/${companyId}`,
          'Updated company storage folder settings.',
          () => updateDoc(companyRef, {
            storageProvider: typedResult.provider ?? null,
            storagePath: typedResult.path ?? null
          })
        ).catch((error) => console.error('Failed to save storage settings', error));
      }
    }));
  }

}
