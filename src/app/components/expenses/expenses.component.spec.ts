import { ComponentFixture, TestBed } from '@angular/core/testing';

import { buildExpenseTagKeys, ExpensesComponent } from './expenses.component';
import { ExpensesService } from '../../services/expenses.service';
import { ClientService } from '../../services/client.service';
import { Firestore } from '@angular/fire/firestore';
import { CurrencyService } from '../../services/currency.service';
import { of } from 'rxjs';
import { TagOptionsService } from '../../services/tag-options.service';

describe('ExpensesComponent', () => {
  let component: ExpensesComponent;
  let fixture: ComponentFixture<ExpensesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesComponent]
      , providers: [
        { provide: ExpensesService, useValue: { listByClientAndMonth: () => of([]), listCompanyLevelByMonth: () => of([]), updateTags: () => Promise.resolve() } },
        { provide: ClientService, useValue: { clients$: () => of([]) } },
        { provide: Firestore, useValue: {} },
        { provide: CurrencyService, useValue: { defaultCurrency: 'ZAR', symbolFor: () => 'R', normalize: () => 'ZAR', format: (value: number) => `R${value}` } },
        { provide: TagOptionsService, useValue: { options$: () => of([]), resolveTagKeys$: () => of([]) } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExpensesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('includes selected and structured relationship tags in new expenses', () => {
    component.selectedTags.set([{ key: 'vat:claimable', type: 'vat', label: 'VAT claimable' }]);

    expect(buildExpenseTagKeys(component.selectedTags(), 'client-1', 'project-1', 'Software / Subscriptions')).toEqual([
      'vat:claimable',
      'client:client-1',
      'project:project-1',
      'category:software'
    ]);
  });
});
