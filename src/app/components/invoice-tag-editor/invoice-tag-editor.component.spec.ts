import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ClientService } from '../../services/client.service';
import { TagOptionsService } from '../../services/tag-options.service';
import { InvoiceTagEditorComponent } from './invoice-tag-editor.component';

describe('InvoiceTagEditorComponent', () => {
  it('persists changed invoice tags', async () => {
    const clients = jasmine.createSpyObj<ClientService>('ClientService', ['updateInvoiceTags']);
    clients.updateInvoiceTags.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [InvoiceTagEditorComponent],
      providers: [
        { provide: ClientService, useValue: clients },
        { provide: TagOptionsService, useValue: { resolveTagKeys$: () => of([]), options$: () => of([]) } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(InvoiceTagEditorComponent);
    fixture.componentRef.setInput('clientId', 'client-1');
    fixture.componentRef.setInput('invoice', { id: 'invoice-1', total: 100, amountPaid: 0, status: 'sent' });
    fixture.detectChanges();

    await fixture.componentInstance.saveTags([
      { key: 'project:project-1', type: 'project', label: 'Website', entityId: 'project-1' }
    ]);

    expect(clients.updateInvoiceTags).toHaveBeenCalledOnceWith('client-1', 'invoice-1', ['project:project-1']);
  });
});
