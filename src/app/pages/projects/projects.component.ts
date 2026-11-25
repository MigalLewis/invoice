import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../components/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { WorkspaceShellComponent } from '../../components/workspace-shell/workspace-shell.component';
import { CustomisationTabsComponent } from '../../components/customisation-tabs/customisation-tabs.component';
import { Client } from '../../models/client.model';
import { Project, ProjectStatus } from '../../models/project.model';
import { ClientService } from '../../services/client.service';
import { CompanyContextService } from '../../services/company-context.service';
import { NotificationService } from '../../services/notification.service';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, WorkspaceShellComponent, StatusBadgeComponent, EmptyStateComponent, LoadingStateComponent, CustomisationTabsComponent],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly companyContext = inject(CompanyContextService);
  private readonly clientService = inject(ClientService);
  private readonly projectService = inject(ProjectService);
  private readonly notifications = inject(NotificationService);

  companyId = signal('');
  clients = signal<Client[]>([]);
  projects = signal<Project[]>([]);
  loading = signal(true);
  creating = signal(false);
  statusFilter = signal<'all' | ProjectStatus>('all');

  visibleProjects = computed(() => this.statusFilter() === 'all'
    ? this.projects()
    : this.projects().filter(project => project.status === this.statusFilter()));
  activeCount = computed(() => this.projects().filter(project => project.status === 'active').length);
  completedCount = computed(() => this.projects().filter(project => project.status === 'completed').length);

  projectForm = this.fb.nonNullable.group({
    clientId: ['', Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    status: ['active' as ProjectStatus, Validators.required]
  });

  constructor() {
    this.companyContext.currentContext$().subscribe({
      next: ({ companyId }) => {
        this.companyId.set(companyId);
        this.clientService.clients$().pipe(
          switchMap(clients => {
            this.clients.set(clients);
            if (!clients.length) return of([] as Project[]);
            return combineLatest(clients.map(client =>
              this.projectService.list(companyId, client.id).pipe(catchError(() => of([] as Project[])))
            )).pipe(map(groups => groups.flat()));
          })
        ).subscribe(projects => {
          this.projects.set(projects);
          this.loading.set(false);
        });
      },
      error: error => this.router.navigate([error?.message === 'Not authenticated' ? '/login' : '/register'])
    });
  }

  async createProject(): Promise<void> {
    if (this.projectForm.invalid || this.creating()) {
      this.projectForm.markAllAsTouched();
      return;
    }
    const value = this.projectForm.getRawValue();
    this.creating.set(true);
    try {
      await this.projectService.create(this.companyId(), value.clientId, {
        name: value.name.trim(),
        description: value.description.trim(),
        status: value.status
      });
      this.projectForm.reset({ clientId: value.clientId, name: '', description: '', status: 'active' });
      this.notifications.success('Project created.');
    } finally {
      this.creating.set(false);
    }
  }

  async setStatus(project: Project, status: ProjectStatus): Promise<void> {
    await this.projectService.setStatus(this.companyId(), project.clientId, project.id, status);
  }

  clientName(clientId: string): string {
    const client = this.clients().find(item => item.id === clientId);
    return client?.companyName || client?.displayName || 'Unknown client';
  }
}
