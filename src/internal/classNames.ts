/** Join defined class names. Kept internal — it is not a public utility. */
export function cx(...values: readonly (string | false | undefined | null)[]): string {
  return values.filter(Boolean).join(' ')
}
