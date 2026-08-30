import { inject, Injectable } from '@angular/core';
import { collectionData, Firestore } from '@angular/fire/firestore';
import { addDoc, collection, orderBy, query, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { CreateProject, Project, ProjectStatus } from '../models/project.model';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly db = inject(Firestore);
  private readonly activity = inject(ActivityService);

  list(companyId: string, clientId: string): Observable<Project[]> {
    const ref = collection(this.db, `companies/${companyId}/clients/${clientId}/projects`);
    return collectionData(query(ref, orderBy('createdAt', 'desc')), { idField: 'id' }) as Observable<Project[]>;
  }

  create(companyId: string, clientId: string, project: CreateProject) {
    const path = `companies/${companyId}/clients/${clientId}/projects`;
    return this.activity.track(companyId, 'create', path, `Created project ${project.name}.`, () =>
      addDoc(collection(this.db, path), {
        ...project,
        clientId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  }

  setStatus(companyId: string, clientId: string, projectId: string, status: ProjectStatus) {
    const path = `companies/${companyId}/clients/${clientId}/projects/${projectId}`;
    return this.activity.track(companyId, 'update', path, `Changed project status to ${status}.`, () =>
      updateDoc(doc(this.db, path), { status, updatedAt: serverTimestamp() })
    );
  }
}
