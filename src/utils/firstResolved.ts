/**
 * Chain of Responsibility over a list of resolvers: asks each one, in order, and returns the first
 * answer that is not `undefined`. The order of the list IS the priority, and each rule is a named,
 * single-purpose function instead of one more level of a nested ternary.
 */
export function firstResolved<Context, Result>(
  context: Context,
  resolvers: Array<(context: Context) => Result | undefined>
): Result | undefined {
  for (const resolve of resolvers) {
    const result = resolve(context);
    if (result !== undefined) return result;
  }
  return undefined;
}
