# Finance Tagging Plan

## Goal

Create a reusable tagging system for bank statement data, expenses, and invoices. Users must be able to add or remove tags at any time and use them to filter or group related financial records, especially by client and project.

## 1. Shared tag model

Introduce a typed tag model with stable identifiers and user-facing labels:

```ts
interface FinanceTag {
  key: string; // For example: "project:project-123"
  type: 'company' | 'client' | 'project' | 'vat' | 'category' | 'status' | 'custom';
  entityId?: string;
  label: string;
}
```

Invoices, expenses, and statement rows will store normalized `tagKeys`. Structured fields such as `clientId` and `projectId` should remain the source of truth for entity relationships. This ensures that renaming a client or project does not break filtering.

## 2. Tag option service

Create a `TagOptionsService` that assembles grouped tag options from:

- The current company
- Client and client-company names
- Project names
- VAT treatments
- Financial categories
- Reconciliation statuses
- Existing custom tags

The service should expose searchable options grouped by tag type and resolve stored keys back to their current display labels.

Initial system-provided tag groups should include:

- Client
- Project
- VAT treatment: claimable, exempt, zero-rated, and non-VAT
- Category: travel, software, rent, equipment, subscriptions, bank fees, and other
- Reconciliation status: unreviewed, matched, needs attention, and reconciled
- Recurrence: once-off and recurring
- Custom tags

## 3. Reusable tag component

Create a standalone `FinanceTagPickerComponent` that supports:

- Searching available tags
- Grouping options by type
- Selecting multiple tags
- Displaying selected tags as removable chips
- Creating custom tags
- Preventing duplicate tags
- Preventing incompatible selections, such as multiple VAT treatments
- Use during record creation and as an inline editor for existing records

The component should emit normalized tag selections without knowing how the parent record is persisted.

## 4. Persistence support

Extend the appropriate data services with tag update operations:

- `ExpensesService.updateTags(...)`
- The invoice service's update operation
- `StatementDataService.updateTags(...)`

Tag changes should be recorded through `ActivityService`. Firestore rules must allow company members to update tags only on records belonging to their company.

A representative stored record should resemble:

```ts
{
  clientId: 'client-456',
  projectId: 'project-123',
  vatTreatment: 'claimable',
  category: 'software',
  reconciliationStatus: 'unreviewed',
  customTagIds: ['audit-2026'],
  tagKeys: [
    'client:client-456',
    'project:project-123',
    'vat:claimable',
    'category:software',
    'status:unreviewed',
    'custom:audit-2026'
  ]
}
```

## 5. Feature integration

Add the tag picker to:

- Expense creation
- Existing expense rows
- Invoice creation
- Existing invoices
- Extracted bank statement rows before they are saved
- Previously saved statement data

Selecting a project tag should infer or offer the project's client tag. Initially, an invoice or expense should have at most one project tag, while allowing multiple tags from other groups.

## 6. Filtering and grouping

Add a tag filter to Finance that can:

- Group invoices, expenses, and statement rows by project
- Filter records by client
- Find VAT-claimable records
- Find unreconciled or problematic statement rows
- Filter by category and custom tags
- Combine filters where supported by Firestore

Use normalized `tagKeys` for querying. Where Firestore cannot combine multiple array filters, query by the most selective tag and apply the remaining filters in the application, or introduce an indexed projection when the data volume requires it.

## 7. Migration

Backfill tags for existing data without removing current relationship fields:

- Convert existing `clientId` values into `client:<id>` tag keys
- Convert existing `projectId` values into `project:<id>` tag keys
- Infer safe category or VAT tags only where the current data is explicit
- Leave uncertain classifications untagged for user review

The migration must be repeatable and avoid duplicating tag keys.

## 8. Verification

Add tests covering:

- Tag option loading and grouping
- Searching and selecting tags
- Duplicate and incompatible-tag prevention
- Adding and removing tags from existing records
- Client and project renaming without broken filters
- Tag persistence for statements, expenses, and invoices
- Company data isolation in Firestore rules
- Filtering and project grouping
- Migration idempotency

## Implementation order

1. Shared tag model and normalization utilities
2. `TagOptionsService`
3. `FinanceTagPickerComponent`
4. Bank statement integration
5. Expense integration
6. Invoice integration
7. Finance filters and project grouping
8. Existing-data migration
9. Firestore rule and end-to-end verification

## Acceptance criteria

- Users can add and remove tags from statements, expenses, and invoices at any time.
- Client and project tags display current names while retaining stable IDs.
- Project-tagged records can be viewed together across all supported financial record types.
- Important tags are validated by type; custom tags remain flexible.
- Tag changes persist securely and appear in activity history.
- Existing client and project relationships continue to work after migration.
