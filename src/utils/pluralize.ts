/**
 * The noun in the form that agrees with `count` ("estudiante" for 1, "estudiantes" otherwise —
 * zero and every other number take the plural). Regular Spanish plurals just add an "s"; pass the
 * plural explicitly for compound nouns ("clase vencida" → "clases vencidas").
 */
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** The count followed by the agreeing noun: "1 estudiante", "5 estudiantes". */
export function countOf(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}
