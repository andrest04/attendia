import React, { useEffect, useState } from 'react';
import { getLocale, subscribeLocale } from './locale';

/**
 * Re-renders the tree when the language changes so `t()` calls in render pick up the new locale.
 * Leaf components do not need a hook, which keeps Enzyme shallow tests on the Spanish default.
 *
 * The tree is passed as a function because React skips children whose element is the same object as
 * last render: a ready-made `children` node would never re-render below this provider. Calling the
 * function on every locale change builds new elements, so the whole subtree re-renders.
 */
export default function LocaleProvider({ children }: { children: () => React.ReactNode }) {
  const [, setLocale] = useState(getLocale);

  useEffect(() => subscribeLocale(() => setLocale(getLocale())), []);

  return <>{children()}</>;
}
