import { EmailTemplateDefinition, EmailTemplateScenario, EmailTemplateType } from '../../models/email-template-designer.model';
import { TemplatePalette } from '../template-colour-selector/template-colour-selector.component';

export interface EmailStarterTemplate {
  id: string;
  name: string;
  description: string;
  audience: string;
  accent: string;
  subject: string;
  sourcePath: string;
  palette: TemplatePalette;
  type: EmailTemplateType;
  scenario: EmailTemplateScenario;
}

const STARTERS: EmailStarterTemplate[] = [
  starter('01-letterhead', 'Letterhead', 'A restrained masthead and generous single-column reading area.', 'General correspondence', ['#243b53', '#526d82', '#e8eef3']),
  starter('02-split-header', 'Split header', 'A two-part header separates the brand from the message context.', 'Invoices and updates', ['#164e63', '#0e7490', '#cffafe']),
  starter('03-sidebar-note', 'Sidebar note', 'A narrow information rail supports a spacious primary message.', 'Detailed messages', ['#334155', '#64748b', '#e2e8f0']),
  starter('04-centred-card', 'Centred card', 'A focused card layout for short announcements and thank-you notes.', 'Announcements', ['#4338ca', '#6366f1', '#e0e7ff']),
  starter('05-editorial', 'Editorial', 'Strong typography and a numbered detail row create a magazine-like rhythm.', 'Project handoffs', ['#3f3f46', '#71717a', '#e4e4e7']),
  starter('06-receipt', 'Receipt', 'A compact summary block makes transactional information easy to find.', 'Payment messages', ['#14532d', '#16a34a', '#dcfce7'])
];

function starter(id: string, name: string, description: string, audience: string, palette: TemplatePalette): EmailStarterTemplate {
  return {
    id, name, description, audience, palette, accent: palette[0],
    subject: 'Update from {{company.name}} for {{client.name}}',
    sourcePath: `/templates/email/${id}.ftl`, type: 'general', scenario: 'general-email'
  };
}

export function createEmailStarters(): EmailStarterTemplate[] {
  return STARTERS.map(item => ({ ...item, palette: [...item.palette] as TemplatePalette }));
}

export function toReadyMadeDefinition(starter: EmailStarterTemplate, companyId: string): EmailTemplateDefinition {
  return {
    schemaVersion: 1,
    companyId,
    name: starter.name,
    subject: starter.subject,
    type: starter.type,
    scenario: starter.scenario,
    sections: [],
    defaultForScenarios: [],
    archived: false,
    sourceKind: 'ready-made',
    starterTemplateId: starter.id,
    theme: { primary: starter.palette[0], secondary: starter.palette[1], accent: starter.palette[2] }
  };
}
