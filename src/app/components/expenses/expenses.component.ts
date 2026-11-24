import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ExpensesService } from '../../services/expenses.service';
import { ClientService } from '../../services/client.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, map, switchMap, take } from 'rxjs';
import { CreateExpense, Expense } from '../../models/expense.model';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { CurrencyService } from '../../services/currency.service';
import { CardHeaderComponent } from '../card-header/card-header.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { Project } from '../../models/project.model';
import { buildFinanceTagKey, FinanceTag, FinanceTagKey, normalizeFinanceTagKeys } from '../../models/finance-tag.model';
import { TagOptionsService } from '../../services/tag-options.service';
import { ExpenseTagEditorComponent } from '../expense-tag-editor/expense-tag-editor.component';
import { FinanceTagPickerComponent } from '../finance-tag-picker/finance-tag-picker.component';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CardHeaderComponent, EmptyStateComponent, FinanceTagPickerComponent, ExpenseTagEditorComponent],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss'
})
export class ExpensesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly expensesService = inject(ExpensesService);
  private readonly clientsService = inject(ClientService);
  private readonly db = inject(Firestore);
  private readonly currencyService = inject(CurrencyService);
  private readonly tagOptionsService = inject(TagOptionsService);

  // Provided by parent
  companyId = input<string>('');
  clientId = input<string | null>(null);
  showClientPicker = input(true);
  title = input('Expenses');
  subtitle = input('Capture and manage business expenses per month');
  projects = input<Project[]>([]);
  projectId = input<string | null>(null);

  // Month selection
  selectedMonth = signal<string>(this.toMonthKey(new Date()));
  private readonly month$ = new BehaviorSubject<string>(this.selectedMonth());
  currency = signal(this.currencyService.defaultCurrency);
  currencySymbol = computed(() => this.currencyService.symbolFor(this.currency()));
  selectedTags = signal<FinanceTag[]>([]);

  constructor() {
    effect(() => {
      const companyId = this.companyId();
      if (!companyId) return;
      docData(doc(this.db, `companies/${companyId}`)).pipe(take(1)).subscribe((company: any) => {
        this.currency.set(this.currencyService.normalize(company?.currency));
      });
    });
    effect(() => {
      this.clientId();
      this.projectId();
      untracked(() => this.syncStructuredTags());
    }, { allowSignalWrites: true });
  }

  // Categories used in the dropdown
  categories = [
    'Fuel / Travel',
    'Software / Subscriptions',
    'Internet / Phone',
    'Office Supplies',
    'Equipment',
    'Meals / Entertainment',
    'Rent',
    'Marketing',
    'Other',
  ];

  // Form matches the HTML
  form = this.fb.nonNullable.group({
    date: [this.todayISO(), [Validators.required]],
    description: ['', [Validators.required, Validators.minLength(2)]],
    category: ['Other', [Validators.required]],
    supplier: [''],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    notes: [''],
    clientId: [null as string | null], // optional
    projectId: [null as string | null],
  });

  // Clients dropdown (optional link)
  clients = this.clientsService.clients$();

  // Expenses list for selected month
  expenses = toSignal(
    this.month$.pipe(
      switchMap(month => {
        const clientId = this.clientId();
        return clientId
          ? this.expensesService.listByClientAndMonth(this.companyId(), clientId, month)
          : this.expensesService.listCompanyLevelByMonth(this.companyId(), month);
      }),
      map(expenses => this.projectId()
        ? expenses.filter(expense => expense.projectId === this.projectId())
        : expenses)
    ),
    { initialValue: [] as Expense[] }
  );

  // Monthly total
  monthlyTotal = computed(() =>
    this.expenses().reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  );

  onMonthChange(value: string) {
    this.selectedMonth.set(value);
    this.month$.next(value);

    // keep the form date inside selected month
    const currentDate = this.form.controls.date.value;
    if (!currentDate.startsWith(value)) {
      this.form.controls.date.setValue(`${value}-01`);
    }
  }

  async addExpense() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    const clientId = this.clientId() ?? v.clientId ?? null;
    const projectId = this.projectId() ?? v.projectId ?? null;
    const payload: CreateExpense = {
      month: v.date.slice(0, 7), // YYYY-MM
      date: v.date,
      description: v.description.trim(),
      category: v.category,
      supplier: v.supplier?.trim() || "",
      amount: Number(v.amount),
      notes: v.notes?.trim() || "",
      clientId,
      projectId,
      tagKeys: buildExpenseTagKeys(this.selectedTags(), clientId, projectId),
    };

    await this.expensesService.add(this.companyId(), payload);

    // reset some fields
    this.form.controls.description.setValue('');
    this.form.controls.supplier.setValue('');
    this.form.controls.amount.setValue(0);
    this.form.controls.notes.setValue('');
    this.form.controls.clientId.setValue(this.clientId());
    this.form.controls.projectId.setValue(this.projectId());
    this.selectedTags.set([]);
    this.syncStructuredTags();
  }

  syncStructuredTags() {
    const clientId = this.clientId() ?? this.form.controls.clientId.value;
    const projectId = this.projectId() ?? this.form.controls.projectId.value;
    const relationshipKeys = [
      ...(clientId ? [buildFinanceTagKey('client', clientId)] : []),
      ...(projectId ? [buildFinanceTagKey('project', projectId)] : [])
    ];
    const otherTags = this.selectedTags().filter(tag => tag.type !== 'client' && tag.type !== 'project');
    if (!relationshipKeys.length) {
      this.selectedTags.set(otherTags);
      return;
    }

    this.tagOptionsService.resolveTagKeys$(relationshipKeys).pipe(take(1)).subscribe(tags => {
      this.selectedTags.set([...otherTags, ...tags]);
    });
  }

  async deleteExpense(expense: Expense) {
    await this.expensesService.remove(this.companyId(), expense.id, expense.clientId, expense.source);
  }

  formatCurrency(value: number) {
    return this.currencyService.format(value, this.currency());
  }

  projectName(projectId?: string | null): string {
    if (!projectId) return '—';
    return this.projects().find(project => project.id === projectId)?.name || 'Unknown project';
  }

  pad2(n: number) {
  return String(n).padStart(2, '0');
  }
  toMonthKey(d: Date) {
    return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}`;
  }
  todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`;
  }
}

export function buildExpenseTagKeys(
  tags: readonly FinanceTag[],
  clientId?: string | null,
  projectId?: string | null
): FinanceTagKey[] {
  return normalizeFinanceTagKeys([
    ...tags.map(tag => tag.key),
    ...(clientId ? [buildFinanceTagKey('client', clientId)] : []),
    ...(projectId ? [buildFinanceTagKey('project', projectId)] : [])
  ]);
}
