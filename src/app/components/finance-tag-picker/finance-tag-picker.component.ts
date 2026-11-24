import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import {
  createCustomFinanceTag,
  deduplicateFinanceTags,
  FinanceTag,
  FinanceTagGroup,
  FinanceTagKey,
  SINGLE_VALUE_TAG_TYPES
} from '../../models/finance-tag.model';
import { TagOptionsService } from '../../services/tag-options.service';

@Component({
  selector: 'app-finance-tag-picker',
  standalone: true,
  templateUrl: './finance-tag-picker.component.html',
  styleUrl: './finance-tag-picker.component.scss'
})
export class FinanceTagPickerComponent {
  private readonly tagOptionsService = inject(TagOptionsService);

  label = input('Tags');
  placeholder = input('Search clients, projects and tags…');
  allowCustom = input(true);
  disabled = input(false);
  customTags = input<readonly FinanceTag[]>([]);
  value = model<FinanceTag[]>([]);
  tagKeysChange = output<FinanceTagKey[]>();

  expanded = signal(false);
  searchQuery = signal('');
  private readonly createdCustomTags = signal<FinanceTag[]>([]);
  private readonly availableCustomTags = computed(() => deduplicateFinanceTags([
    ...this.customTags(),
    ...this.createdCustomTags()
  ]));

  groups = toSignal(
    toObservable(this.availableCustomTags).pipe(
      switchMap(customTags => this.tagOptionsService.options$(customTags))
    ),
    { initialValue: [] as FinanceTagGroup[] }
  );

  filteredGroups = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase();
    if (!query) return this.groups();

    return this.groups()
      .map(group => ({
        ...group,
        options: group.options.filter(option =>
          option.label.toLocaleLowerCase().includes(query)
          || option.contextLabel?.toLocaleLowerCase().includes(query)
          || group.label.toLocaleLowerCase().includes(query)
        )
      }))
      .filter(group => group.options.length > 0);
  });

  selectedKeys = computed(() => new Set(this.value().map(tag => tag.key)));

  togglePicker(): void {
    if (!this.disabled()) this.expanded.update(expanded => !expanded);
  }

  closePicker(): void {
    this.expanded.set(false);
    this.searchQuery.set('');
  }

  updateSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  isSelected(tag: FinanceTag): boolean {
    return this.selectedKeys().has(tag.key);
  }

  toggleTag(tag: FinanceTag): void {
    if (this.disabled()) return;

    const selected = this.value();
    if (selected.some(item => item.key === tag.key)) {
      this.commit(selected.filter(item => item.key !== tag.key));
      return;
    }

    const compatibleTags = SINGLE_VALUE_TAG_TYPES.has(tag.type)
      ? selected.filter(item => item.type !== tag.type)
      : selected;
    this.commit(deduplicateFinanceTags([...compatibleTags, tag]));
  }

  removeTag(tag: FinanceTag): void {
    if (!this.disabled()) this.commit(this.value().filter(item => item.key !== tag.key));
  }

  createCustomTag(): void {
    const label = this.searchQuery().trim();
    if (!this.allowCustom() || !label || this.disabled()) return;

    let tag: FinanceTag;
    try {
      tag = createCustomFinanceTag(label);
    } catch {
      return;
    }

    const existing = this.availableCustomTags().find(option => option.key === tag.key);
    if (!existing) this.createdCustomTags.update(tags => [...tags, tag]);
    if (!this.isSelected(existing ?? tag)) this.toggleTag(existing ?? tag);
    this.searchQuery.set('');
  }

  private commit(tags: FinanceTag[]): void {
    this.value.set(tags);
    this.tagKeysChange.emit(tags.map(tag => tag.key));
  }
}
