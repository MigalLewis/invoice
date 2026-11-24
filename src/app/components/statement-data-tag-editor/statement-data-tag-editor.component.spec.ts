import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatementDataService } from '../../services/statement-data.service';
import { TagOptionsService } from '../../services/tag-options.service';
import { StatementDataTagEditorComponent } from './statement-data-tag-editor.component';

describe('StatementDataTagEditorComponent', () => {
  it('persists updated tag keys for its statement row', async () => {
    const statementData = jasmine.createSpyObj<StatementDataService>('StatementDataService', ['updateTags']);
    statementData.updateTags.and.resolveTo();
    const tagOptions = {
      resolveTagKeys$: () => of([]),
      options$: () => of([])
    };

    await TestBed.configureTestingModule({
      imports: [StatementDataTagEditorComponent],
      providers: [
        { provide: StatementDataService, useValue: statementData },
        { provide: TagOptionsService, useValue: tagOptions }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(StatementDataTagEditorComponent);
    fixture.componentRef.setInput('companyId', 'company-1');
    fixture.componentRef.setInput('record', { id: 'row-1', tagKeys: [], values: [], headers: [] });
    fixture.detectChanges();

    await fixture.componentInstance.saveTags([
      { key: 'project:project-1', type: 'project', label: 'Website', entityId: 'project-1' }
    ]);

    expect(statementData.updateTags).toHaveBeenCalledOnceWith('company-1', 'row-1', ['project:project-1']);
    expect(fixture.componentInstance.error()).toBe('');
  });
});
