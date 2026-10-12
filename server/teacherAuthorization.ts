export interface TeacherAuthorizationDatabase {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data(): { [key: string]: any } | undefined }>;
    };
  };
}

/**
 * Resolves whether the verified uid holds role=teacher in Firestore (users/{uid}.role,
 * written by userProfiles.ts). Throws on Firestore failure; callers map that to their
 * own 503. The 401/403 handling around it lives in teacherHandler.ts.
 */
export async function resolveIsTeacher(db: TeacherAuthorizationDatabase, uid: string): Promise<boolean> {
  const snapshot = await db
    .collection('users')
    .doc(uid)
    .get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.role === 'teacher';
}
