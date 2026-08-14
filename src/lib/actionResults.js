export async function runBulkActions(items, action) {
  const outcomes = await Promise.all(items.map(async (item) => {
    try {
      const result = await action(item)
      if (!result?.success) {
        return { item, success: false, error: result?.error || 'Operation failed' }
      }
      return { item, success: true, data: result.data }
    } catch (error) {
      return {
        item,
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed'
      }
    }
  }))

  return {
    succeeded: outcomes.filter(outcome => outcome.success),
    failed: outcomes.filter(outcome => !outcome.success)
  }
}
