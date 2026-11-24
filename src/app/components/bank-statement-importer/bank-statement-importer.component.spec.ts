import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BankStatementApiService } from '../../services/bank-statement-api.service';
import { BankStatementImporterComponent } from './bank-statement-importer.component';

describe('BankStatementImporterComponent', () => {
  let component: BankStatementImporterComponent;
  let fixture: ComponentFixture<BankStatementImporterComponent>;
  let api: jasmine.SpyObj<BankStatementApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<BankStatementApiService>('BankStatementApiService', [
      'rotatePdf',
      'extractStatement',
      'exportStatement'
    ]);

    await TestBed.configureTestingModule({
      imports: [BankStatementImporterComponent],
      providers: [{ provide: BankStatementApiService, useValue: api }]
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
});
