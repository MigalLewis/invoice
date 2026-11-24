import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinanceTag, FinanceTagGroup } from '../../models/finance-tag.model';
import { TagOptionsService } from '../../services/tag-options.service';
import { FinanceTagPickerComponent } from './finance-tag-picker.component';

describe('FinanceTagPickerComponent', () => {
  let fixture: ComponentFixture<FinanceTagPickerComponent>;
  let component: FinanceTagPickerComponent;

  const clientTag: FinanceTag = { key: 'client:client-1', type: 'client', label: 'Acme Ltd', entityId: 'client-1' };
  const secondClientTag: FinanceTag = { key: 'client:client-2', type: 'client', label: 'Nexus Ltd', entityId: 'client-2' };
  const projectTag: FinanceTag = { key: 'project:project-1', type: 'project', label: 'Website', entityId: 'project-1', contextLabel: 'Acme Ltd' };
  const groups: FinanceTagGroup[] = [
    { type: 'client', label: 'Clients', options: [clientTag, secondClientTag] },
    { type: 'project', label: 'Projects', options: [projectTag] }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinanceTagPickerComponent],
      providers: [{ provide: TagOptionsService, useValue: { options$: () => of(groups) } }]
    }).compileComponents();

    fixture = TestBed.createComponent(FinanceTagPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('selects tags and emits normalized keys', () => {
    const emitted: string[][] = [];
    component.tagKeysChange.subscribe(keys => emitted.push(keys));

    component.toggleTag(clientTag);
    component.toggleTag(projectTag);

    expect(component.value()).toEqual([clientTag, projectTag]);
    expect(emitted.at(-1)).toEqual(['client:client-1', 'project:project-1']);
  });

  it('replaces an existing tag when its type accepts only one value', () => {
    component.toggleTag(clientTag);
    component.toggleTag(secondClientTag);

    expect(component.value()).toEqual([secondClientTag]);
  });

  it('creates custom tags without creating duplicates', () => {
    component.searchQuery.set('Audit 2026');
    component.createCustomTag();
    component.searchQuery.set('Audit 2026');
    component.createCustomTag();

    expect(component.value()).toEqual([{
      key: 'custom:audit-2026',
      type: 'custom',
      label: 'Audit 2026'
    }]);
  });

  it('filters options using labels and contextual client names', () => {
    component.searchQuery.set('acme');

    expect(component.filteredGroups().map(group => group.type)).toEqual(['client', 'project']);
    expect(component.filteredGroups()[1].options).toEqual([projectTag]);
  });
});
