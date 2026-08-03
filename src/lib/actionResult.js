/**
 * Server actions resolve to `{ success: false, error }` for expected failures.
 * Promise.all therefore does not reject on its own; callers must inspect every
 * result before displaying a success message.
 */
export function getFailedActionResults(results = []) {
  return results.filter(result => !result?.success)
}

export function assertActionSucceeded(result, fallbackMessage = 'The request failed') {
  if (result?.success) return result
  throw new Error(result?.error || fallbackMessage)
}

export function assertAllActionsSucceeded(results, fallbackMessage = 'One or more requests failed') {
  const failures = getFailedActionResults(results)
  if (failures.length === 0) return results

  const firstMessage = failures.find(result => result?.error)?.error
  const suffix = failures.length > 1 ? ` (${failures.length} failed)` : ''
  throw new Error(`${firstMessage || fallbackMessage}${suffix}`)
}
