import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Expense } from '../../models/expense.model';
import { ExpensesService } from '../../services/expenses.service';
import { TagOptionsService } from '../../services/tag-options.service';
import { ExpenseTagEditorComponent } from './expense-tag-editor.component';

describe('ExpenseTagEditorComponent', () => {
  it('persists changed expense tags', async () => {
    const expenses = jasmine.createSpyObj<ExpensesService>('ExpensesService', ['updateTags']);
    expenses.updateTags.and.resolveTo();
    const expense: Expense = {
      id: 'expense-1', month: '2026-11', date: '2026-11-01',
      description: 'Hosting', category: 'Software', amount: 500,
      clientId: 'client-1', projectId: 'project-1'
    };

    await TestBed.configureTestingModule({
      imports: [ExpenseTagEditorComponent],
      providers: [
        { provide: ExpensesService, useValue: expenses },
        { provide: TagOptionsService, useValue: { resolveTagKeys$: () => of([]), options$: () => of([]) } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ExpenseTagEditorComponent);
    fixture.componentRef.setInput('companyId', 'company-1');
    fixture.componentRef.setInput('expense', expense);
    fixture.detectChanges();

    await fixture.componentInstance.saveTags([
      { key: 'vat:claimable', type: 'vat', label: 'VAT claimable', entityId: 'claimable' }
    ]);

    expect(expenses.updateTags).toHaveBeenCalledOnceWith('company-1', expense, [
      'vat:claimable',
      'client:client-1',
      'project:project-1',
      'category:software'
    ]);
  });
});
