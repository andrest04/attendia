import { createContext, useContext } from 'react';

/**
 * Imperative handle to (re)open the onboarding tour from outside the tutorial
 * component. Provided by Room and consumed by the professor's "Ayuda" button in
 * SessionStatusBar, which is far from the tutorial in the tree. Defaults to a
 * no-op so consumers render fine without a provider (unit tests, Storybook).
 */
export interface OnboardingContextValue {
  /** (Re)open the tour from the first step, regardless of the "already seen" flag. */
  openTour: () => void;
}

export const OnboardingContext = createContext<OnboardingContextValue>({
  openTour: () => {},
});

export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}
