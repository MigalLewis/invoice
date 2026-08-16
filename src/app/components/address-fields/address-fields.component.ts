import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-address-fields',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './address-fields.component.html',
  styleUrl: './address-fields.component.scss'
})
export class AddressFieldsComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() showBuilding = true;
  @Input() showSuburb = true;
  @Input() requiredFields: string[] = [];

  required(name: string): boolean { return this.requiredFields.includes(name); }
}
