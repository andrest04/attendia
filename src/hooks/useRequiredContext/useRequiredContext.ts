import { Context, useContext } from 'react';

/**
 * Reads a context that must be provided: outside its provider the context is empty, and
 * this throws a readable error naming the hook and the provider it needs instead of letting
 * a consumer crash on `undefined`. Backs useVideoContext, useChatContext,
 * useParticipantContext and useAttention, which differ only in the names in the message.
 */
export default function useRequiredContext<T>(
  context: Context<T>,
  hookName: string,
  providerName: string
): NonNullable<T> {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${hookName} must be used within ${providerName}`);
  }
  return value as NonNullable<T>;
}
