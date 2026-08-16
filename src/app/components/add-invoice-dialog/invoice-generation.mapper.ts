import { Client } from '../../models/client.model';

export interface InvoiceItemInput {
  description?: string;
  rate?: number | string;
  hours?: number | string;
}

export interface GeneratedInvoiceItem {
  description: string;
  rate: number;
  hours: number;
  amount: number;
  total: number;
  [key: string]: unknown;
}

export interface InvoiceTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
}

export function normalizeInvoiceItems(items: InvoiceItemInput[]): GeneratedInvoiceItem[] {
  return items.map(item => {
    const rate = Number(item.rate) || 0;
    const hours = Number(item.hours) || 0;
    const amount = +(rate * hours).toFixed(2);

    return {
      description: item.description || '',
      rate,
      hours,
      amount,
      total: amount
    };
  });
}

export function calculateInvoiceTotals(items: GeneratedInvoiceItem[], includeVat: boolean): InvoiceTotals {
  const subtotal = +items.reduce((sum, item) => sum + item.amount, 0).toFixed(2);
  const vatAmount = includeVat ? +(subtotal * 0.15).toFixed(2) : 0;
  return { subtotal, vatAmount, total: +(subtotal + vatAmount).toFixed(2) };
}

export function clientTemplateFields(client?: Client | null) {
  const address = client?.address;
  const clientName = client?.clientType === 'company'
    ? (client.companyName || client.displayName || 'Unknown Client')
    : ([client?.firstName, client?.lastName].filter(Boolean).join(' ') || client?.displayName || 'Unknown Client');

  return {
    client_name: clientName,
    client_title: client?.title || '',
    client_building: address?.building || '',
    client_line1: address?.line1 || '',
    client_line2: address?.line2 || '',
    client_street: address?.line1 || '',
    client_suburb: address?.suburb || '',
    client_city: address?.city || '',
    client_province: address?.province || '',
    client_postal_code: address?.postalCode || '',
    client_country: address?.country || '',
    client_contact_no: client?.phone || '',
    client_email: client?.email || ''
  };
}
