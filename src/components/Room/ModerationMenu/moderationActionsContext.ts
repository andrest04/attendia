import { createContext, useContext } from 'react';
import { StudentModerationHandlers } from './studentModerationItems';

/**
 * The teacher's moderation actions, provided by Room only to a teacher so the gallery tiles can
 * offer the same menu as the roster. `null` (students, tests, Storybook) means "no moderation".
 */
export const ModerationActionsContext = createContext<StudentModerationHandlers | null>(null);

export function useModerationActions(): StudentModerationHandlers | null {
  return useContext(ModerationActionsContext);
}
