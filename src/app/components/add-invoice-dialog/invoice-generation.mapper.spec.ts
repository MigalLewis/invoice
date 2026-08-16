import { calculateInvoiceTotals, clientTemplateFields, normalizeInvoiceItems } from './invoice-generation.mapper';

describe('invoice generation mapper', () => {
  it('normalizes line items and calculates VAT totals', () => {
    const items = normalizeInvoiceItems([{ description: 'Consulting', rate: '125.50', hours: 2 }]);

    expect(items).toEqual([{
      description: 'Consulting', rate: 125.5, hours: 2, amount: 251, total: 251
    }]);
    expect(calculateInvoiceTotals(items, true)).toEqual({ subtotal: 251, vatAmount: 37.65, total: 288.65 });
  });

  it('maps company and nested address fields for document templates', () => {
    const fields = clientTemplateFields({
      id: 'client-1',
      clientType: 'company',
      companyName: 'Nexus Systems',
      displayName: 'Nexus Systems',
      email: 'accounts@nexus.example',
      phone: '+27891231234',
      address: { building: 'Nexus House', line1: '10 Main Road', city: 'Cape Town', postalCode: '8001', country: 'South Africa' },
      createdAt: 0
    });

    expect(fields.client_name).toBe('Nexus Systems');
    expect(fields.client_building).toBe('Nexus House');
    expect(fields.client_line1).toBe('10 Main Road');
    expect(fields.client_email).toBe('accounts@nexus.example');
  });
});
