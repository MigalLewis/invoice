export type EmailProvider = 'gmail' | 'microsoft_exchange' | 'company_sendgrid' | 'nexus_fallback';
export type LegacyEmailProvider = 'sendgrid';

export interface EmailSenderIdentity {
  email?: string;
  displayName?: string;
}

export interface ProviderConnectionSettings {
  connected: boolean;
  configured?: boolean;
  health?: string;
  connectedAt?: any;
  connectedBy?: string;
  accountEmail?: string;
  tenantId?: string;
  apiKeyConfigured?: boolean;
  fromEmail?: string;
  fromName?: string;
  webhookConfigured?: boolean;
}

export interface CompanyEmailSettings {
  companyId: string;
  defaultProvider: EmailProvider;
  selectedSender?: EmailSenderIdentity;
  gmail?: ProviderConnectionSettings;
  microsoftExchange?: ProviderConnectionSettings;
  sendgrid?: ProviderConnectionSettings;
  nexusFallback?: { enabled: boolean; configured?: boolean };
  updatedAt?: any;
}

export const EMAIL_PROVIDER_LABELS: Record<EmailProvider, string> = {
  gmail: 'Google Workspace Gmail',
  microsoft_exchange: 'Microsoft 365 Exchange',
  company_sendgrid: 'Company SendGrid',
  nexus_fallback: 'Nexus managed fallback',
};

export const DEFAULT_EMAIL_SETTINGS: Omit<CompanyEmailSettings, 'companyId'> = {
  defaultProvider: 'nexus_fallback',
  gmail: { connected: false },
  microsoftExchange: { connected: false },
  sendgrid: { connected: false, apiKeyConfigured: false },
  nexusFallback: { enabled: false, configured: false },
};
