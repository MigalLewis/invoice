import { Client } from '../../models/client.model';

export function clientInitials(client: Client | null): string {
  return (client?.displayName || 'Client')
    .split(' ')
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

export function clientFormattedAddress(client: Client | null): string {
  const address = client?.address;
  if (!address) return 'Address not provided';
  return [address.building, address.line1, address.line2, address.suburb, address.city, address.province, address.postalCode, address.country]
    .filter(Boolean)
    .join(', ');
}

export function clientTypeLabel(client: Client | null): string {
  const type = client?.clientType || (client?.title || client?.firstName || client?.lastName ? 'client' : 'company');
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function clientStatusClass(status: string): string {
  const normalized = status.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return normalized === 'not-provided' ? 'status-draft' : `status-${normalized}`;
}
