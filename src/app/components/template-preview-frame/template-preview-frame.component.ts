import { Component, inject, Input, OnChanges, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-template-preview-frame',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="preview-loading" *ngIf="html === null">{{ loadingMessage }}</div>
    <iframe *ngIf="url() as previewUrl" [src]="previewUrl" [title]="title" sandbox=""></iframe>
  `,
  styleUrl: './template-preview-frame.component.scss'
})
export class TemplatePreviewFrameComponent implements OnChanges, OnDestroy {
  @Input() html: string | null = null;
  @Input() title = 'Template preview';
  @Input() loadingMessage = 'Loading preview…';

  private readonly sanitizer = inject(DomSanitizer);
  private objectUrl: string | null = null;
  readonly url = signal<SafeResourceUrl | null>(null);

  ngOnChanges(): void {
    this.release();
    if (this.html === null) return;
    this.objectUrl = URL.createObjectURL(new Blob([this.html], { type: 'text/html' }));
    this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
  }

  ngOnDestroy(): void {
    this.release();
  }

  private release(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.url.set(null);
  }
}
