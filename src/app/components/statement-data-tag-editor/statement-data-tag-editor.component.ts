import { Component, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { FinanceTagPickerComponent } from '../finance-tag-picker/finance-tag-picker.component';
import { FinanceTag } from '../../models/finance-tag.model';
import { StatementData } from '../../models/statement-data.model';
import { StatementDataService } from '../../services/statement-data.service';
import { TagOptionsService } from '../../services/tag-options.service';

@Component({
  selector: 'app-statement-data-tag-editor',
  standalone: true,
  imports: [FinanceTagPickerComponent],
  template: `
    <app-finance-tag-picker
      label="Tags"
      [value]="draftTags()"
      (valueChange)="saveTags($event)"
    />
    @if (saving()) {
      <small class="save-state">Saving tags…</small>
    }
    @if (error()) {
      <small class="save-state error" role="alert">{{ error() }}</small>
    }
  `,
  styles: [`
    :host { display: block; min-width: 280px; }
    .save-state { display: block; margin-top: 5px; color: var(--muted); font-size: 11px; }
    .save-state.error { color: var(--danger); }
  `]
})
export class StatementDataTagEditorComponent {
  private readonly statementDataService = inject(StatementDataService);
  private readonly tagOptionsService = inject(TagOptionsService);

  companyId = input('');
  record = input<StatementData | null>(null);
  draftTags = signal<FinanceTag[]>([]);
  saving = signal(false);
  error = signal('');

  private readonly resolvedTags = toSignal(
    toObservable(this.record).pipe(
      switchMap(record => record
        ? this.tagOptionsService.resolveTagKeys$(record.tagKeys ?? [])
        : of([] as FinanceTag[]))
    ),
    { initialValue: [] as FinanceTag[] }
  );

  constructor() {
    effect(() => this.draftTags.set(this.resolvedTags()), { allowSignalWrites: true });
  }

  async saveTags(tags: FinanceTag[]): Promise<void> {
    const companyId = this.companyId();
    const record = this.record();
    if (!companyId || !record) return;

    this.draftTags.set(tags);
    this.saving.set(true);
    this.error.set('');
    try {
      await this.statementDataService.updateTags(
        companyId,
        record.id,
        tags.map(tag => tag.key)
      );
    } catch {
      this.error.set('Tags could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }
}
