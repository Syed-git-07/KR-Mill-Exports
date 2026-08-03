export async function filterReasonsWithActiveHeads(transaction, reasons = []) {
  const headIds = [...new Set(reasons.map(reason => reason?.stoppage_head_id).filter(Boolean))]
  if (headIds.length === 0) return reasons

  const activeHeads = await transaction.stoppage_heads.findMany({
    where: { id: { in: headIds }, is_active: true },
    select: { id: true }
  })
  const activeHeadIds = new Set(activeHeads.map(head => head.id))
  return reasons.filter(reason => (
    !reason.stoppage_head_id || activeHeadIds.has(reason.stoppage_head_id)
  ))
}

export async function assertActiveStoppageReasons(transaction, stoppageUpdate, departmentNames = []) {
  const reasonIds = [...new Set(
    [1, 2, 3, 4]
      .map(slot => stoppageUpdate?.[`stoppage${slot}_id`])
      .filter(Boolean)
  )]

  if (reasonIds.length === 0) return

  let departmentIds
  if (departmentNames.length > 0) {
    const departments = await transaction.departments.findMany({
      where: { dept_name: { in: departmentNames } },
      select: { id: true }
    })
    departmentIds = departments.map(department => department.id)
  }

  const reasonRows = departmentIds?.length === 0
    ? []
    : await transaction.stoppage_details.findMany({
        where: {
          id: { in: reasonIds },
          is_active: true,
          ...(departmentIds ? { department_id: { in: departmentIds } } : {})
        },
        select: { id: true, stoppage_head_id: true }
      })

  const validReasons = (await filterReasonsWithActiveHeads(transaction, reasonRows)).length

  if (validReasons !== reasonIds.length) {
    const error = new Error('Every stoppage must use an active stoppage reason')
    error.code = 'INVALID_STOPPAGE_REASON'
    throw error
  }
}
