import { TeacherAuthorizationDatabase } from './teacherAuthorization';

export type DocumentSnapshot = {
  exists: boolean;
  id?: string;
  data(): { [key: string]: any } | undefined;
};
// A document snapshot returned from a query/collection read: unlike a bare
// DocumentSnapshot fetched by id, these always carry an id and a ref back to the
// document (real Firestore's QueryDocumentSnapshot behaves the same way).
export type QueryDocumentSnapshot = DocumentSnapshot & { id: string; ref: Document };
export type QuerySnapshot = { docs: QueryDocumentSnapshot[] };
export type Query = {
  where(field: string, operator: string, value: unknown): Query;
  orderBy(field: string, direction: 'asc' | 'desc'): Query;
  startAfter(...values: unknown[]): Query;
  limit(value: number): Query;
  get(): Promise<QuerySnapshot>;
};
export type Collection = {
  doc(id: string): Document;
  orderBy(field: string, direction: 'asc' | 'desc'): Query;
  where(field: string, operator: string, value: unknown): Query;
  get(): Promise<QuerySnapshot>;
};
export type Document = {
  id: string;
  get(): Promise<DocumentSnapshot>;
  collection(name: string): Collection;
};
export type Transaction = {
  get(document: Document): Promise<DocumentSnapshot>;
  get(query: Query): Promise<QuerySnapshot>;
  create(document: Document, value: { [key: string]: any }): void;
  update(document: Document, value: { [key: string]: any }): void;
  delete(document: Document): void;
};

export interface NotificationsDatabase extends TeacherAuthorizationDatabase {
  collection(name: string): { doc(id: string): Document };
  runTransaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;
}

export interface Cursor {
  generation: number;
  eventOccurrenceAtMs: number;
  createdAtMs: number;
  id: string;
}

export type EventType = 'class.upcoming' | 'class.not_started' | 'recording.ready' |
  'recording.failed' | 'report.save_failed';

export interface CanonicalNotificationCandidate {
  eventType: EventType;
  eventKey: string;
  source: { [key: string]: unknown };
  eventOccurrenceAt: unknown;
  title: string;
  message: string;
  destination: { [key: string]: unknown };
}
