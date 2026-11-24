import { inject, Injectable } from '@angular/core';
import { collection, doc, Firestore, serverTimestamp, writeBatch } from '@angular/fire/firestore';
import { CreateStatementData } from '../models/statement-data.model';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class StatementDataService {
  private readonly db = inject(Firestore);
  private readonly activityService = inject(ActivityService);

  addMany(companyId: string, rows: CreateStatementData[]): Promise<void> {
    const collectionPath = `companies/${companyId}/statementData`;
    const statementData = collection(this.db, collectionPath);

    return this.activityService.track(
      companyId,
      'create',
      collectionPath,
      `Saved ${rows.length} classified bank statement row${rows.length === 1 ? '' : 's'}.`,
      async () => {
        const batch = writeBatch(this.db);
        rows.forEach(row => {
          batch.set(doc(statementData), {
            ...row,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }
    );
  }
}
