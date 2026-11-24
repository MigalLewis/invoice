import { Component, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { FinanceTag } from '../../models/finance-tag.model';
import { InvoiceRecord } from '../../models/invoice.model';
import { ClientService } from '../../services/client.service';
import { TagOptionsService } from '../../services/tag-options.service';
import { FinanceTagPickerComponent } from '../finance-tag-picker/finance-tag-picker.component';

@Component({
  selector: 'app-invoice-tag-editor',
  standalone: true,
  imports: [FinanceTagPickerComponent],
  template: `
    <app-finance-tag-picker label="Tags" [value]="draftTags()" (valueChange)="saveTags($event)" />
    @if (saving()) { <small class="save-state">Saving tags…</small> }
    @if (error()) { <small class="save-state error" role="alert">{{ error() }}</small> }
  `,
  styles: [`
    :host { display: block; min-width: 260px; }
    .save-state { display: block; margin-top: 5px; color: var(--muted); font-size: 11px; }
    .save-state.error { color: var(--danger); }
  `]
})
export class InvoiceTagEditorComponent {
  private readonly clientService = inject(ClientService);
  private readonly tagOptionsService = inject(TagOptionsService);

  clientId = input('');
  invoice = input<InvoiceRecord | null>(null);
  draftTags = signal<FinanceTag[]>([]);
  saving = signal(false);
  error = signal('');

  private readonly resolvedTags = toSignal(
    toObservable(this.invoice).pipe(
      switchMap(invoice => invoice
        ? this.tagOptionsService.resolveTagKeys$(invoice.tagKeys ?? [])
        : of([] as FinanceTag[]))
    ),
    { initialValue: [] as FinanceTag[] }
  );

  constructor() {
    effect(() => this.draftTags.set(this.resolvedTags()), { allowSignalWrites: true });
  }

  async saveTags(tags: FinanceTag[]): Promise<void> {
    const clientId = this.clientId();
    const invoice = this.invoice();
    if (!clientId || !invoice?.id) return;

    this.draftTags.set(tags);
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.clientService.updateInvoiceTags(clientId, invoice.id, tags.map(tag => tag.key)));
    } catch {
      this.error.set('Tags could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }
}
