import { inject, Injectable } from '@angular/core';
import { catchError, combineLatest, map, Observable, of, startWith, switchMap } from 'rxjs';
import { Client } from '../models/client.model';
import {
  createFinanceTag,
  deduplicateFinanceTags,
  FinanceTag,
  FinanceTagGroup,
  FinanceTagKey,
  FinanceTagType,
  parseFinanceTagKey
} from '../models/finance-tag.model';
import { Project } from '../models/project.model';
import { ClientService } from './client.service';
import { CompanyContextService } from './company-context.service';
import { ProjectService } from './project.service';

const GROUP_LABELS: Record<FinanceTagType, string> = {
  company: 'Company',
  client: 'Clients',
  project: 'Projects',
  vat: 'VAT treatment',
  category: 'Categories',
  status: 'Reconciliation status',
  recurrence: 'Recurrence',
  custom: 'Custom tags'
};

const GROUP_ORDER: FinanceTagType[] = [
  'company',
  'client',
  'project',
  'vat',
  'category',
  'status',
  'recurrence',
  'custom'
];

const SYSTEM_TAGS: FinanceTag[] = [
  createFinanceTag('vat', 'VAT claimable', 'claimable'),
  createFinanceTag('vat', 'VAT exempt', 'exempt'),
  createFinanceTag('vat', 'Zero-rated', 'zero-rated'),
  createFinanceTag('vat', 'Non-VAT', 'non-vat'),
  createFinanceTag('category', 'Travel', 'travel'),
  createFinanceTag('category', 'Software', 'software'),
  createFinanceTag('category', 'Rent', 'rent'),
  createFinanceTag('category', 'Equipment', 'equipment'),
  createFinanceTag('category', 'Subscriptions', 'subscriptions'),
  createFinanceTag('category', 'Bank fees', 'bank-fees'),
  createFinanceTag('category', 'Other', 'other'),
  createFinanceTag('status', 'Unreviewed', 'unreviewed'),
  createFinanceTag('status', 'Matched', 'matched'),
  createFinanceTag('status', 'Needs attention', 'needs-attention'),
  createFinanceTag('status', 'Reconciled', 'reconciled'),
  createFinanceTag('recurrence', 'Once-off', 'once-off'),
  createFinanceTag('recurrence', 'Recurring', 'recurring')
];

@Injectable({ providedIn: 'root' })
export class TagOptionsService {
  private readonly companyContext = inject(CompanyContextService);
  private readonly clientService = inject(ClientService);
  private readonly projectService = inject(ProjectService);

  options$(customTags: readonly FinanceTag[] = []): Observable<FinanceTagGroup[]> {
    return combineLatest([
      this.companyContext.currentCompanyId$().pipe(
        startWith(null),
        catchError(() => of(null))
      ),
      this.companyContext.currentCompany$().pipe(
        startWith(null),
        catchError(() => of(null))
      ),
      this.clientService.clients$().pipe(
        startWith([] as Client[]),
        catchError(() => of([] as Client[]))
      )
    ]).pipe(
      switchMap(([companyId, company, clients]) => this.loadProjects(companyId, clients).pipe(
        map(projects => this.buildGroups(
          companyId && company
            ? [createFinanceTag('company', company.name || company.companyName || 'Current company', companyId)]
            : [],
          clients,
          projects,
          customTags
        ))
      ))
    );
  }

  flatOptions$(customTags: readonly FinanceTag[] = []): Observable<FinanceTag[]> {
    return this.options$(customTags).pipe(
      map(groups => groups.flatMap(group => group.options))
    );
  }

  resolveTagKeys$(keys: readonly FinanceTagKey[], customTags: readonly FinanceTag[] = []): Observable<FinanceTag[]> {
    return this.flatOptions$(customTags).pipe(
      map(options => {
        const byKey = new Map(options.map(option => [option.key, option]));
        return keys.map(key => byKey.get(key) ?? this.fallbackTag(key));
      })
    );
  }

  private loadProjects(companyId: string | null, clients: Client[]): Observable<Project[]> {
    if (!companyId || clients.length === 0) return of([]);

    return combineLatest(clients.map(client =>
      this.projectService.list(companyId, client.id).pipe(catchError(() => of([] as Project[])))
    )).pipe(map(projectGroups => projectGroups.flat()));
  }

  private buildGroups(
    companyTags: FinanceTag[],
    clients: Client[],
    projects: Project[],
    customTags: readonly FinanceTag[]
  ): FinanceTagGroup[] {
    const clientTags = clients.map(client => createFinanceTag(
      'client',
      client.companyName || client.displayName,
      client.id,
      client.companyName && client.companyName !== client.displayName ? client.displayName : undefined
    ));
    const clientNames = new Map(clients.map(client => [client.id, client.companyName || client.displayName]));
    const projectTags = projects.map(project => createFinanceTag(
      'project',
      project.name,
      project.id,
      clientNames.get(project.clientId) || 'Unknown client'
    ));
    const allTags = deduplicateFinanceTags([
      ...companyTags,
      ...clientTags,
      ...projectTags,
      ...SYSTEM_TAGS,
      ...customTags.filter(tag => tag.type === 'custom')
    ]);

    return GROUP_ORDER.map(type => ({
      type,
      label: GROUP_LABELS[type],
      options: allTags
        .filter(tag => tag.type === type)
        .sort((left, right) => left.label.localeCompare(right.label))
    })).filter(group => group.options.length > 0 || group.type === 'custom');
  }

  private fallbackTag(key: FinanceTagKey): FinanceTag {
    const parsed = parseFinanceTagKey(key);
    if (!parsed) throw new Error(`Invalid finance tag key: ${key}`);
    return {
      key,
      type: parsed.type,
      label: parsed.value.replace(/[-_]+/g, ' '),
      ...(parsed.type === 'company' || parsed.type === 'client' || parsed.type === 'project'
        ? { entityId: parsed.value }
        : {})
    };
  }
}
