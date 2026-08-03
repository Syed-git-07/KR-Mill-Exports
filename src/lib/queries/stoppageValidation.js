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

  const validReasons = departmentIds?.length === 0
    ? 0
    : await transaction.stoppage_details.count({
        where: {
          id: { in: reasonIds },
          is_active: true,
          ...(departmentIds ? { department_id: { in: departmentIds } } : {})
        }
      })

  if (validReasons !== reasonIds.length) {
    const error = new Error('Every stoppage must use an active stoppage reason')
    error.code = 'INVALID_STOPPAGE_REASON'
    throw error
  }
}
