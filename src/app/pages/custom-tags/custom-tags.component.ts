import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { doc, Firestore, updateDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { CustomisationTabsComponent } from '../../components/customisation-tabs/customisation-tabs.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../components/loading-state/loading-state.component';
import { WorkspaceShellComponent } from '../../components/workspace-shell/workspace-shell.component';
import { createCustomFinanceTag, FinanceTag } from '../../models/finance-tag.model';
import { ActivityService } from '../../services/activity.service';
import { CompanyContextService } from '../../services/company-context.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-custom-tags',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, WorkspaceShellComponent, CustomisationTabsComponent, EmptyStateComponent, LoadingStateComponent],
  templateUrl: './custom-tags.component.html',
  styleUrl: './custom-tags.component.scss'
})
export class CustomTagsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly db = inject(Firestore);
  private readonly router = inject(Router);
  private readonly companyContext = inject(CompanyContextService);
  private readonly activity = inject(ActivityService);
  private readonly notifications = inject(NotificationService);

  companyId = signal('');
  tags = signal<FinanceTag[]>([]);
  loading = signal(true);
  saving = signal(false);
  sortedTags = computed(() => [...this.tags()].sort((a, b) => a.label.localeCompare(b.label)));
  form = this.fb.nonNullable.group({ label: ['', [Validators.required, Validators.minLength(2)]] });

  constructor() {
    this.companyContext.currentContext$().subscribe({
      next: ({ companyId }) => {
        this.companyId.set(companyId);
        this.companyContext.currentCompany$().pipe(take(1)).subscribe((company: any) => {
          this.tags.set(this.tagsFromCompany(company));
          this.loading.set(false);
        });
      },
      error: error => this.router.navigate([error?.message === 'Not authenticated' ? '/login' : '/register'])
    });
  }

  async addTag(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    let tag: FinanceTag;
    try {
      tag = createCustomFinanceTag(this.form.controls.label.value);
    } catch {
      this.form.controls.label.setErrors({ invalidTag: true });
      return;
    }
    if (this.tags().some(item => item.key === tag.key)) {
      this.form.controls.label.setErrors({ duplicate: true });
      return;
    }
    await this.saveTags([...this.tags(), tag], `Created custom tag ${tag.label}.`);
    this.form.reset({ label: '' });
  }

  async removeTag(tag: FinanceTag): Promise<void> {
    await this.saveTags(this.tags().filter(item => item.key !== tag.key), `Removed custom tag ${tag.label}.`);
  }

  private async saveTags(tags: FinanceTag[], description: string): Promise<void> {
    const companyId = this.companyId();
    if (!companyId) return;
    this.saving.set(true);
    try {
      const labels = tags.map(tag => tag.label);
      await this.activity.track(companyId, 'update', `companies/${companyId}`, description, () =>
        updateDoc(doc(this.db, `companies/${companyId}`), { customFinanceTags: labels })
      );
      this.tags.set(tags);
      this.notifications.success('Custom tags updated.');
    } finally {
      this.saving.set(false);
    }
  }

  private tagsFromCompany(company: any): FinanceTag[] {
    if (!Array.isArray(company?.customFinanceTags)) return [];
    return company.customFinanceTags.flatMap((label: unknown) => {
      if (typeof label !== 'string') return [];
      try { return [createCustomFinanceTag(label)]; } catch { return []; }
    });
  }
}
