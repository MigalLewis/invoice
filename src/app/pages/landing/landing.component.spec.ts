import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LandingComponent } from './landing.component';
import { Firestore } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { CurrencyService } from '../../services/currency.service';
import { ClientService } from '../../services/client.service';
import { ExpensesService } from '../../services/expenses.service';
import { ActivityService } from '../../services/activity.service';
import { CompanyContextService } from '../../services/company-context.service';
import { throwError } from 'rxjs';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent]
      , providers: [
        { provide: Firestore, useValue: {} },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: Dialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: CurrencyService, useValue: { defaultCurrency: 'ZAR', symbolFor: () => 'R', normalize: () => 'ZAR' } },
        { provide: ClientService, useValue: {} },
        { provide: ExpensesService, useValue: {} },
        { provide: ActivityService, useValue: {} },
        { provide: CompanyContextService, useValue: { currentContext$: () => throwError(() => new Error('Not authenticated')) } }
      ]
    })
    .overrideComponent(LandingComponent, { set: { template: '' } })
    .compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('applies tag and date filters to every dashboard financial metric', () => {
    component.updateCustomDate('from', '2026-01-01');
    component.updateCustomDate('to', '2026-01-31');
    component.selectedFilterTags.set([{
      key: 'project:project-1',
      type: 'project',
      label: 'Project One',
      entityId: 'project-1'
    }]);
    component.invoices.set([
      { id: 'paid', date: '2026-01-10', paidAt: '2026-01-15', total: 100, amountPaid: 100, status: 'paid', tagKeys: ['project:project-1'] },
      { id: 'partial', date: '2026-01-20', total: 200, amountPaid: 50, status: 'partial', tagKeys: ['project:project-1'] },
      { id: 'other-project', date: '2026-01-12', total: 500, amountPaid: 500, status: 'paid', tagKeys: ['project:project-2'] },
      { id: 'outside-period', date: '2025-12-20', total: 800, amountPaid: 800, status: 'paid', tagKeys: ['project:project-1'] }
    ] as any);
    component.expenses.set([
      { id: 'expense-1', date: '2026-01-18', month: '2026-01', description: 'Hosting', category: 'Software', amount: 30, tagKeys: ['project:project-1'] },
      { id: 'other-expense', date: '2026-01-18', month: '2026-01', description: 'Travel', category: 'Travel', amount: 300, tagKeys: ['project:project-2'] }
    ]);

    expect(component.revenue()).toBe(150);
    expect(component.outstanding()).toBe(150);
    expect(component.expenseTotal()).toBe(30);
    expect(component.netProfit()).toBe(120);
    expect(component.chartMonths().map(month => [month.incomeTotal, month.expenseTotal])).toEqual([[150, 30]]);
  });
});
