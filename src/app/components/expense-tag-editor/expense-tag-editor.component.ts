import { Component, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { Expense } from '../../models/expense.model';
import { FinanceTag } from '../../models/finance-tag.model';
import { ExpensesService } from '../../services/expenses.service';
import { TagOptionsService } from '../../services/tag-options.service';
import { FinanceTagPickerComponent } from '../finance-tag-picker/finance-tag-picker.component';
import { effectiveFinanceTagKeys } from '../../utils/finance-tag-filter';

@Component({
  selector: 'app-expense-tag-editor',
  standalone: true,
  imports: [FinanceTagPickerComponent],
  template: `
    <app-finance-tag-picker label="Tags" [value]="draftTags()" (valueChange)="saveTags($event)" />
    @if (saving()) { <small class="save-state">Saving tags…</small> }
    @if (error()) { <small class="save-state error" role="alert">{{ error() }}</small> }
  `,
  styles: [`
    :host { display: block; min-width: 280px; }
    .save-state { display: block; margin-top: 5px; color: var(--muted); font-size: 11px; }
    .save-state.error { color: var(--danger); }
  `]
})
export class ExpenseTagEditorComponent {
  private readonly expensesService = inject(ExpensesService);
  private readonly tagOptionsService = inject(TagOptionsService);

  companyId = input('');
  expense = input<Expense | null>(null);
  draftTags = signal<FinanceTag[]>([]);
  saving = signal(false);
  error = signal('');

  private readonly resolvedTags = toSignal(
    toObservable(this.expense).pipe(
      switchMap(expense => expense
        ? this.tagOptionsService.resolveTagKeys$(effectiveFinanceTagKeys(expense))
        : of([] as FinanceTag[]))
    ),
    { initialValue: [] as FinanceTag[] }
  );

  constructor() {
    effect(() => this.draftTags.set(this.resolvedTags()), { allowSignalWrites: true });
  }

  async saveTags(tags: FinanceTag[]): Promise<void> {
    const companyId = this.companyId();
    const expense = this.expense();
    if (!companyId || !expense) return;

    this.draftTags.set(tags);
    this.saving.set(true);
    this.error.set('');
    try {
      const tagKeys = effectiveFinanceTagKeys({
        ...expense,
        tagKeys: tags.map(tag => tag.key)
      });
      await this.expensesService.updateTags(companyId, expense, tagKeys);
    } catch {
      this.error.set('Tags could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }
}
