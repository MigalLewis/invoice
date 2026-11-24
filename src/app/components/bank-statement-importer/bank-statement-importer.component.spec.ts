import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BankStatementApiService } from '../../services/bank-statement-api.service';
import { StatementDataService } from '../../services/statement-data.service';
import { BankStatementImporterComponent } from './bank-statement-importer.component';

describe('BankStatementImporterComponent', () => {
  let component: BankStatementImporterComponent;
  let fixture: ComponentFixture<BankStatementImporterComponent>;
  let api: jasmine.SpyObj<BankStatementApiService>;
  let statementData: jasmine.SpyObj<StatementDataService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<BankStatementApiService>('BankStatementApiService', [
      'rotatePdf',
      'extractStatement',
      'exportStatement'
    ]);
    statementData = jasmine.createSpyObj<StatementDataService>('StatementDataService', ['addMany']);

    await TestBed.configureTestingModule({
      imports: [BankStatementImporterComponent],
      providers: [
        { provide: BankStatementApiService, useValue: api },
        { provide: StatementDataService, useValue: statementData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BankStatementImporterComponent);
    component = fixture.componentInstance;
  });

  it('offers the supported banks and starts without a selection', () => {
    expect(component.banks.map(bank => bank.type)).toEqual([
      'STANDARD_BANK',
      'FNB',
      'CAPITEC',
      'ABSA',
      'NEDBANK'
    ]);
    expect(component.selectedBank()).toBeNull();
  });

  it('extracts the selected statement and exposes its table rows', () => {
    const response = {
      accountNumber: '123456789',
      rows: [
        ['Date', 'Description', 'Amount'],
        ['2026-11-01', 'Hosting', '499.00']
      ]
    };
    const bank = component.banks[0];
    const file = new File(['statement'], 'statement.pdf', { type: 'application/pdf' });
    api.extractStatement.and.returnValue(of(response));

    component.selectBank(bank);
    component.selectedFile.set(file);
    component.extractStatement();

    expect(api.extractStatement).toHaveBeenCalledOnceWith(file, 'STANDARD_BANK');
    expect(component.headers).toEqual(['Date', 'Description', 'Amount']);
    expect(component.bodyRows).toEqual([['2026-11-01', 'Hosting', '499.00']]);
    expect(component.message()).toBe('Statement extracted successfully.');
  });

  it('saves checked rows with the selected classification and statement metadata', async () => {
    const response = {
      accountNumber: '123456789',
      rows: [
        ['Date', 'Description', 'Amount'],
        ['2026-11-01', 'Hosting', '499.00'],
        ['2026-11-02', 'Invoice payment', '2500.00']
      ]
    };
    const bank = component.banks[0];
    const file = new File(['statement'], 'november.pdf', { type: 'application/pdf' });
    statementData.addMany.and.resolveTo();

    fixture.componentRef.setInput('companyId', 'company-1');
    component.selectBank(bank);
    component.selectedFile.set(file);
    component.result.set(response);
    component.setStatementType('paid_invoice');
    component.toggleRow(1, true);

    await component.saveSelectedRows();

    expect(statementData.addMany).toHaveBeenCalledOnceWith('company-1', [{
      type: 'paid_invoice',
      bankType: 'STANDARD_BANK',
      bankName: 'Standard Bank',
      sourceFileName: 'november.pdf',
      accountNumber: '123456789',
      headers: ['Date', 'Description', 'Amount'],
      values: ['2026-11-02', 'Invoice payment', '2500.00'],
      statementRowIndex: 2
    }]);
    expect(component.selectedRows().size).toBe(0);
    expect(component.message()).toContain('1 statement row added as paid invoice');
  });
});
