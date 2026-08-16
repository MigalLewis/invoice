import { clientFormattedAddress, clientInitials, clientStatusClass, clientTypeLabel } from './client-summary.presenter';

describe('client summary presenter', () => {
  const client = {
    id: 'client-1', displayName: 'Pacific Fish', companyName: 'Pacific Fish', clientType: 'company',
    address: { building: 'Harbour Centre', line1: '1 Dock Road', city: 'Cape Town', country: 'South Africa' },
    createdAt: 0
  };

  it('formats summary values consistently', () => {
    expect(clientInitials(client)).toBe('PF');
    expect(clientFormattedAddress(client)).toBe('Harbour Centre, 1 Dock Road, Cape Town, South Africa');
    expect(clientTypeLabel(client)).toBe('Company');
    expect(clientStatusClass('Not provided')).toBe('status-draft');
  });
});
