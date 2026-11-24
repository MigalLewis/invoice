import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { createCustomFinanceTag } from '../models/finance-tag.model';
import { ClientService } from './client.service';
import { CompanyContextService } from './company-context.service';
import { ProjectService } from './project.service';
import { TagOptionsService } from './tag-options.service';

describe('TagOptionsService', () => {
  let service: TagOptionsService;
  let projectService: jasmine.SpyObj<ProjectService>;

  beforeEach(() => {
    const companyContext = {
      currentCompanyId$: () => of('company-1'),
      currentCompany$: () => of({ name: 'Nexus Consulting' })
    };
    const clientService = {
      clients$: () => of([
        { id: 'client-1', displayName: 'Acme Contact', companyName: 'Acme Ltd', createdAt: 0 },
        { id: 'client-2', displayName: 'Jane Doe', createdAt: 0 }
      ])
    };
    projectService = jasmine.createSpyObj<ProjectService>('ProjectService', ['list']);
    projectService.list.and.callFake((_companyId, clientId) => of(clientId === 'client-1'
      ? [{ id: 'project-1', clientId, name: 'Website Redesign', status: 'active' as const }]
      : [{ id: 'project-2', clientId, name: 'Annual Report', status: 'active' as const }]
    ));

    TestBed.configureTestingModule({
      providers: [
        { provide: CompanyContextService, useValue: companyContext },
        { provide: ClientService, useValue: clientService },
        { provide: ProjectService, useValue: projectService }
      ]
    });
    service = TestBed.inject(TagOptionsService);
  });

  it('combines company, client, project, system, and custom options into groups', async () => {
    const groups = await firstValueFrom(service.options$([createCustomFinanceTag('Audit 2026')]));

    expect(groups.find(group => group.type === 'company')?.options[0]).toEqual(jasmine.objectContaining({
      key: 'company:company-1',
      label: 'Nexus Consulting'
    }));
    expect(groups.find(group => group.type === 'client')?.options.map(option => option.key)).toEqual([
      'client:client-1',
      'client:client-2'
    ]);
    expect(groups.find(group => group.type === 'project')?.options).toContain(jasmine.objectContaining({
      key: 'project:project-1',
      label: 'Website Redesign',
      contextLabel: 'Acme Ltd'
    }));
    expect(groups.find(group => group.type === 'vat')?.options.length).toBe(4);
    expect(groups.find(group => group.type === 'custom')?.options[0].key).toBe('custom:audit-2026');
    expect(projectService.list).toHaveBeenCalledTimes(2);
  });

  it('resolves stored keys using current names and provides a fallback for missing options', async () => {
    const tags = await firstValueFrom(service.resolveTagKeys$([
      'project:project-1',
      'custom:legacy-review'
    ]));

    expect(tags[0].label).toBe('Website Redesign');
    expect(tags[1]).toEqual({
      key: 'custom:legacy-review',
      type: 'custom',
      label: 'legacy review'
    });
  });
});
