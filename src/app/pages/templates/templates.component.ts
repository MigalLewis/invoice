import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { collection, collectionData, Firestore } from '@angular/fire/firestore';
import { NavBarComponent } from '../../components/nav-bar/nav-bar.component';
import { WorkspaceTopbarComponent } from '../../components/workspace-topbar/workspace-topbar.component';
import { CompanyTemplate } from '../../models/invoice.model';
import { normalizeTemplateFormat } from '../../services/template-renderer.service';
import { TemplateService } from '../../services/template.service';
import { LetterDocxService } from '../../services/letter-docx.service';
import { CompanyContextService } from '../../services/company-context.service';
import { WorkspaceShellComponent } from '../../components/workspace-shell/workspace-shell.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { EmailTemplateDefinition, EmailTemplateScenario } from '../../models/email-template-designer.model';
import { EMAIL_TEMPLATE_SCENARIOS, EmailTemplateDefinitionService } from '../../components/template-designer/services/email-template-definition.service';
import { Dialog } from '@angular/cdk/dialog';
import { EmailTemplatePreviewDataService } from '../../components/template-designer/services/email-template-preview-data.service';
import { TemplateCreationType, TemplateCreationWizardComponent } from '../../components/template-creation-wizard/template-creation-wizard.component';
import { DocumentTemplatePreviewService } from '../../services/document-template-preview.service';
import { NotificationService } from '../../services/notification.service';
import { RenameTemplateDialogComponent } from '../../components/rename-template-dialog/rename-template-dialog.component';
import { TemplatePreviewFrameComponent } from '../../components/template-preview-frame/template-preview-frame.component';
import { TemplateGalleryCardComponent } from '../../components/template-gallery-card/template-gallery-card.component';

type TemplateType = 'invoice' | 'letter';
type TemplateTab = 'overview' | 'invoices' | 'letters' | 'emails';
type TemplateStatusFilter = 'active' | 'archived';

export interface TemplateDocument extends CompanyTemplate {
  category?: string;
  description?: string;
  fileUrl: string;
  previewUrl?: string;
  active: boolean;
  archived?: boolean;
}

export interface TemplateCard extends TemplateDocument {
  accent: 'invoice' | 'letter' | 'professional';
}

interface GalleryCardBase {
  id: string;
  name: string;
  description: string;
  badge: string;
  detail: string;
  defaults: string[];
  archived: boolean;
  viewAction: 'view' | 'download';
}

type GalleryCard =
  | (GalleryCardBase & { kind: 'invoice' | 'letter'; source: TemplateCard })
  | (GalleryCardBase & { kind: 'email'; source: EmailTemplateDefinition });


export type TemplateFilter = 'active' | 'archived' | TemplateType;

export function filterTemplates(templates: TemplateCard[], filter: TemplateFilter): TemplateCard[] {
  switch (filter) {
    case 'invoice':
    case 'letter':
      return templates.filter(template => template.type === filter && !template.archived);
    case 'archived':
      return templates.filter(template => !!template.archived);
    case 'active':
    default:
      return templates.filter(template => template.active && !template.archived);
  }
}

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, RouterLink, NavBarComponent, WorkspaceTopbarComponent, WorkspaceShellComponent, EmptyStateComponent, TemplatePreviewFrameComponent, TemplateGalleryCardComponent],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss'
})
export class TemplatesComponent {
  private db = inject(Firestore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private templateService = inject(TemplateService);
  private letterDocx = inject(LetterDocxService);
  private companyContext = inject(CompanyContextService);
  private emailTemplateDefinitions = inject(EmailTemplateDefinitionService);
  private dialog = inject(Dialog);
  private previewData = inject(EmailTemplatePreviewDataService);
  private documentPreview = inject(DocumentTemplatePreviewService);
  private notifications = inject(NotificationService);

  protected readonly activeTab = signal<TemplateTab>('overview');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly templates = signal<TemplateCard[]>([]);
  protected readonly statusFilter = signal<TemplateStatusFilter>('active');
  protected readonly designedEmailTemplates = signal<EmailTemplateDefinition[]>([]);
  protected readonly previewEmailTemplate = signal<EmailTemplateDefinition | null>(null);
  protected readonly previewEmailHtml = signal<string | null>(null);
  protected readonly previewDocumentTemplate = signal<GalleryCard | null>(null);
  protected readonly previewDocumentHtml = signal<string | null>(null);
  protected readonly scenarios = EMAIL_TEMPLATE_SCENARIOS;

  constructor() {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    if (requestedTab === 'emails' || requestedTab === 'letters' || requestedTab === 'invoices') this.activeTab.set(requestedTab);
    if (requestedTab === 'gallery') this.activeTab.set('invoices');
    this.loadCompanyTemplates();
  }

  protected readonly documentTemplates = computed(() => {
    const type: TemplateType = this.activeTab() === 'letters' ? 'letter' : 'invoice';
    const archived = this.statusFilter() === 'archived';
    return this.templates().filter(template => template.type === type && !!template.archived === archived);
  });
  protected readonly filteredEmailTemplates = computed(() => {
    const archived = this.statusFilter() === 'archived';
    return this.designedEmailTemplates().filter(template => !!template.archived === archived);
  });
  protected readonly galleryCards = computed<GalleryCard[]>(() => {
    if (this.activeTab() === 'emails') {
      return this.filteredEmailTemplates().map(template => ({
        kind: 'email',
        id: template.id ?? template.name,
        name: template.name,
        description: template.subject,
        badge: template.type,
        detail: `${template.sections.length} section${template.sections.length === 1 ? '' : 's'}`,
        defaults: (template.defaultForScenarios ?? []).map(scenario => this.scenarioLabel(scenario)),
        archived: !!template.archived,
        viewAction: 'view',
        source: template
      }));
    }
    return this.documentTemplates().map(template => ({
      kind: template.type,
      id: template.id,
      name: template.name,
      description: template.description ?? template.fileName ?? template.name,
      badge: this.formatLabels[template.format || 'docx'] || template.format || 'Custom Word document',
      detail: '',
      defaults: [],
      archived: !!template.archived,
      viewAction: normalizeTemplateFormat(template) === 'docx' ? 'download' : 'view',
      source: template
    }));
  });
  protected readonly invoiceTemplateCount = computed(() => this.templates().filter(template => template.type === 'invoice' && !template.archived).length);
  protected readonly letterTemplateCount = computed(() => this.templates().filter(template => template.type === 'letter' && !template.archived).length);
  protected readonly emailTemplateCount = computed(() => this.designedEmailTemplates().filter(template => !template.archived).length);
  protected readonly formatLabels: Record<string, string> = { docx: 'Custom Word document', 'freemarker-html': 'Ready-made design', 'pdf-mapped': 'Mapped PDF' };
  protected readonly totalTemplateCount = computed(() => this.templates().filter(template => template.active && !template.archived).length + this.emailTemplateCount());

  protected setTab(tab: TemplateTab): void {
    this.activeTab.set(tab);
  }

  protected openUploadFlow(): void {
    this.openCreationWizard(this.activeTab() === 'letters' ? 'letter' : 'invoice');
  }

  protected toggleStatusFilter(): void {
    this.statusFilter.update(current => current === 'active' ? 'archived' : 'active');
  }

  protected galleryTypeLabel(): string {
    return this.activeTab() === 'emails' ? 'Email' : this.activeTab() === 'letters' ? 'Letter' : 'Invoice';
  }

  protected galleryAddDescription(): string {
    return this.activeTab() === 'emails'
      ? 'Choose a ready-made design or start from scratch.'
      : 'Upload a custom Word document or choose a ready-made design.';
  }

  protected addGalleryTemplate(): void {
    if (this.activeTab() === 'emails') this.newEmailTemplate();
    else this.openUploadFlow();
  }

  protected renameGalleryTemplate(template: GalleryCard): void {
    const ref = this.dialog.open<string | null>(RenameTemplateDialogComponent, {
      data: { name: template.name },
      width: 'min(92vw, 420px)',
      backdropClass: 'dlg-backdrop',
      panelClass: 'rename-template-dialog-panel'
    });
    ref.closed.subscribe(name => {
      if (name && name !== template.name) void this.applyTemplateRename(template, name);
    });
  }

  private async applyTemplateRename(template: GalleryCard, name: string): Promise<void> {
    try {
      const companyId = await this.companyContext.requireCompanyIdOnce();
      if (template.kind === 'email') {
        if (template.source.id) await this.emailTemplateDefinitions.rename(companyId, template.source.id, name);
      } else {
        await this.templateService.renameTemplate(companyId, template.source.id, name);
      }
    } catch (e: any) {
      const message = e?.message ?? 'Unable to rename template.';
      this.error.set(message);
      this.notifications.error(message, e);
    }
  }

  protected duplicateGalleryTemplate(template: GalleryCard): void {
    if (template.kind === 'email') void this.duplicateDesignedEmailTemplate(template.source);
    else void this.duplicateTemplate(template.source);
  }

  protected viewGalleryTemplate(template: GalleryCard): void {
    if (template.kind === 'email') this.previewDesignedEmailTemplate(template.source);
    else if (template.viewAction === 'download') void this.viewTemplate(template.source);
    else void this.previewDesignedDocumentTemplate(template);
  }

  protected async archiveGalleryTemplate(template: GalleryCard): Promise<void> {
    try {
      if (template.kind === 'email') {
        await this.archiveDesignedEmailTemplate(template.source);
        return;
      }
      const companyId = await this.companyContext.requireCompanyIdOnce();
      await this.templateService.archiveTemplate(companyId, template.source.id, !template.source.archived);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Unable to update template archive status.');
    }
  }

  protected closeDocumentPreview(): void {
    this.previewDocumentTemplate.set(null);
    this.previewDocumentHtml.set(null);
  }

  protected async previewDesignedDocumentTemplate(template: GalleryCard & { kind: 'invoice' | 'letter' }): Promise<void> {
    this.previewDocumentTemplate.set(template);
    this.previewDocumentHtml.set(null);
    try {
      const source = await this.templateService.getTemplateSource(template.source.storagePath);
      const previewHtml = this.documentPreview.buildHtml(source);
      this.previewDocumentHtml.set(previewHtml);
    } catch (e: any) {
      this.closeDocumentPreview();
      this.error.set(e?.message ?? 'Unable to preview template.');
    }
  }

  protected async onLetterTemplatePicked(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    try {
      const companyId = await this.companyContext.requireCompanyIdOnce();
      await this.letterDocx.uploadTemplate(companyId, file);
      this.error.set(null);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Unable to upload letter template.');
    }
  }

  protected async duplicateTemplate(template: TemplateCard): Promise<void> {
    try {
      const companyId = await this.companyContext.requireCompanyIdOnce();
      await this.templateService.duplicateTemplate(companyId, template);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Unable to duplicate template.');
    }
  }

  protected async viewTemplate(template: TemplateCard): Promise<void> {
    try {
      const url = await this.templateService.getDownloadUrl(template.bodyStoragePath || template.storagePath);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      this.error.set(e?.message ?? 'Unable to open template.');
    }
  }

  protected async previewDesignedEmailTemplate(template: EmailTemplateDefinition): Promise<void> {
    this.previewEmailTemplate.set(template);
    try {
      const source = await this.emailTemplateDefinitions.getSource(template);
      const html = this.previewData.renderTokens(source.replace(/\$\{\s*([a-zA-Z0-9_.]+)(?:\?html)?\s*}/g, '{{$1}}'));
      this.previewEmailHtml.set(html);
    } catch (e: any) {
      this.previewEmailTemplate.set(null);
      this.error.set(e?.message ?? 'Unable to preview email template.');
    }
  }

  protected closeEmailPreview(): void {
    this.previewEmailTemplate.set(null);
    this.previewEmailHtml.set(null);
  }

  protected async duplicateDesignedEmailTemplate(template: EmailTemplateDefinition): Promise<void> {
    try {
      const companyId = await this.companyContext.requireCompanyIdOnce();
      await this.emailTemplateDefinitions.duplicate(companyId, template);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Unable to duplicate email template.');
    }
  }

  protected async archiveDesignedEmailTemplate(template: EmailTemplateDefinition): Promise<void> {
    if (!template.id) return;
    const companyId = await this.companyContext.requireCompanyIdOnce();
    await this.emailTemplateDefinitions.archive(companyId, template.id, !template.archived);
  }

  protected scenarioLabel(scenario: EmailTemplateScenario): string {
    return this.scenarios.find(item => item.value === scenario)?.label ?? scenario;
  }

  protected newEmailTemplate(): void {
    this.openCreationWizard('email');
  }

  private openCreationWizard(initialType: TemplateCreationType): void {
    this.dialog.open(TemplateCreationWizardComponent, {
      data: { initialType },
      width: 'min(97vw, 1440px)',
      maxWidth: '1440px',
      maxHeight: '97vh',
      backdropClass: 'dlg-backdrop',
      panelClass: 'template-creation-wizard-panel'
    });
  }

  private async loadCompanyTemplates(): Promise<void> {
    try {
      const companyId = await this.companyContext.requireCompanyIdOnce();
      this.emailTemplateDefinitions.list(companyId).subscribe(templates => this.designedEmailTemplates.set(templates));
      collectionData(collection(this.db, `companies/${companyId}/templates`), { idField: 'id' }).subscribe({
        next: templates => {
          this.templates.set((templates as CompanyTemplate[]).map(template => this.toTemplateCard(companyId, template)));
          this.loading.set(false);
          this.error.set(null);
        },
        error: err => {
          console.error('Failed to load company templates', err);
          this.error.set('Unable to load templates.');
          this.loading.set(false);
        }
      });
    } catch (err: any) {
      await this.router.navigate([err?.message === 'Not authenticated' ? '/login' : '/register']);
    }
  }

  private toTemplateCard(companyId: string, template: CompanyTemplate): TemplateCard {
    const type = template.type as TemplateType;
    const name = template.name || (type === 'letter' ? 'Letter Template' : 'Invoice Template');
    return {
      ...template,
      companyId: template.companyId || companyId,
      name,
      type,
      category: type === 'letter' ? 'Letter' : 'Invoice',
      description: `${template.fileName || name} • ${this.formatLabels[normalizeTemplateFormat(template)]} • stored at ${template.bodyStoragePath || template.storagePath}.`,
      fileUrl: template.bodyStoragePath || template.storagePath,
      active: !template.archived,
      accent: type === 'letter' ? 'letter' : 'invoice'
    };
  }
}
