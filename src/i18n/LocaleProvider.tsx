import React, { useEffect, useState } from 'react';
import { getLocale, subscribeLocale } from './locale';

/**
 * Re-renders the tree when the language changes so `t()` calls in render pick up the new locale.
 * Leaf components do not need a hook, which keeps Enzyme shallow tests on the Spanish default.
 */
export default function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [, setLocale] = useState(getLocale);

  useEffect(() => subscribeLocale(() => setLocale(getLocale())), []);

  return <>{children}</>;
}
