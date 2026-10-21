import { createElement, Fragment, HTMLAttributes, ReactNode } from 'react';

/** Placeholder value passed to `t()` where a translated sentence embeds an emphasized part. */
export const EMPHASIS_MARK = '\u0001';

/**
 * Renders a translated sentence whose `{{...}}` placeholder was filled with EMPHASIS_MARK,
 * wrapping `emphasized` in <strong> (or `tag`). Keeps word order translatable without the `Trans`
 * component, so shallow-rendered tests still see the sentence.
 */
export function emphasize(
  sentence: string,
  emphasized: ReactNode,
  props: HTMLAttributes<HTMLElement> = {},
  tag: 'strong' | 'span' = 'strong'
): ReactNode {
  const parts = sentence.split(EMPHASIS_MARK);
  if (parts.length === 1) return sentence;
  return createElement(
    Fragment,
    null,
    ...parts.flatMap((part, index) =>
      index < parts.length - 1 ? [part, createElement(tag, { ...props, key: index }, emphasized)] : [part]
    )
  );
}
