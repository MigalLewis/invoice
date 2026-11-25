import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-customisation-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="customisation-tabs" aria-label="Customisation sections">
      <a routerLink="/templates" routerLinkActive="active">Templates</a>
      <a routerLink="/projects" routerLinkActive="active">Projects</a>
      <a routerLink="/custom-tags" routerLinkActive="active">Custom Tags</a>
    </nav>
  `,
  styles: [`
    .customisation-tabs { width: 100%; display: flex; gap: 28px; border-bottom: 1px solid var(--border); }
    a { padding: 14px 0 16px; border-bottom: 3px solid transparent; color: var(--muted); font-weight: 800; text-decoration: none; }
    a.active { border-bottom-color: var(--primary); color: var(--primary); }
    @media (max-width: 520px) { .customisation-tabs { gap: 18px; overflow-x: auto; } a { white-space: nowrap; } }
  `]
})
export class CustomisationTabsComponent {}
