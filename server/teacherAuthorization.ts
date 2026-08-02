import { Response } from 'express';

export interface TeacherAuthorizationDatabase {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data(): { [key: string]: any } | undefined }>;
    };
  };
}

export async function authorizeTeacher(
  db: TeacherAuthorizationDatabase,
  res: Response
): Promise<string | undefined> {
  const user = res.locals && res.locals.firebaseUser;
  if (!user || typeof user.uid !== 'string' || !user.uid) {
    res.status(401).send();
    return undefined;
  }

  const profile = await db.collection('users').doc(user.uid).get();
  if (!profile.exists || (profile.data() || {}).role !== 'teacher') {
    res.status(403).json({
      error: {
        message: 'teacher role required',
        explanation: 'Las notificaciones solo están disponibles para profesores.',
      },
    });
    return undefined;
  }
  return user.uid;
}
