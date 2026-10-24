import { toClassSessionRoomName } from '../../classSession/classSessionTypes';
import { t } from '../../i18n/translate';

/** What the "Nueva clase" form holds: the raw inputs, before any of them is trusted. */
export interface NewClassFormValues {
  title: string;
  date: Date | null;
  time: Date | null;
  studentCount: string;
  durationMinutes: string;
}

export interface NewClassInput {
  title: string;
  roomName: string;
  scheduledAtMs: number;
  studentCount: number;
  durationMinutes: number;
}

export type NewClassValidation = { ok: true; value: NewClassInput } | { ok: false; message: string };

const isValidDate = (value: Date | null): value is Date => value !== null && !isNaN(value.getTime());

const fail = (message: string): NewClassValidation => ({ ok: false, message });

/**
 * Checks the form in the order the teacher fills it in and stops at the first problem, so the
 * message always points at the first thing to fix. Pure: the clock is injected, which is what
 * makes "no puedes programar una clase en el pasado" testable.
 */
export function validateNewClass(form: NewClassFormValues, nowMs: number): NewClassValidation {
  const title = form.title.trim();
  if (!title) return fail(t('Indica un título para la clase.'));

  if (!isValidDate(form.date) || !isValidDate(form.time)) return fail(t('Indica la fecha y la hora de la clase.'));

  const studentCount = Number(form.studentCount);
  if (!Number.isFinite(studentCount) || studentCount < 0)
    return fail(t('La cantidad de alumnos esperados no es válida.'));

  const durationMinutes = Number(form.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0)
    return fail(t('La duración de la clase no es válida.'));

  const scheduledAtMs = new Date(
    form.date.getFullYear(),
    form.date.getMonth(),
    form.date.getDate(),
    form.time.getHours(),
    form.time.getMinutes()
  ).getTime();
  if (!Number.isFinite(scheduledAtMs)) return fail(t('La fecha y hora indicadas no son válidas.'));
  if (scheduledAtMs < nowMs) return fail(t('No puedes programar una clase en una fecha u hora pasada.'));

  return {
    ok: true,
    value: { title, roomName: toClassSessionRoomName(title), scheduledAtMs, studentCount, durationMinutes },
  };
}
