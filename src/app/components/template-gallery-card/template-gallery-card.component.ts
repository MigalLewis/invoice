import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type TemplateGalleryKind = 'invoice' | 'letter' | 'email';

@Component({
  selector: 'app-template-gallery-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './template-gallery-card.component.html',
  styleUrl: './template-gallery-card.component.scss'
})
export class TemplateGalleryCardComponent {
  @Input({ required: true }) name = '';
  @Input({ required: true }) kind: TemplateGalleryKind = 'invoice';
  @Input() badge = '';
  @Input() detail = '';
  @Input() defaults: string[] = [];
  @Input() archived = false;
  @Input() viewAction: 'view' | 'download' = 'view';

  @Output() renamed = new EventEmitter<void>();
  @Output() duplicated = new EventEmitter<void>();
  @Output() viewed = new EventEmitter<void>();
  @Output() archiveChanged = new EventEmitter<void>();
}
