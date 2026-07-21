const SYSTEM_FIELDS = new Set(['id', 'created_at', 'updated_at', 'entry_date', 'shift'])

function cloneData(row, entryDate, shift) {
  return Object.fromEntries([
    ...Object.entries(row)
      .filter(([key]) => !SYSTEM_FIELDS.has(key)),
    ['entry_date', entryDate],
    ['shift', shift]
  ])
}

/**
 * Materializes an independent setup snapshot for one production header.
 * A new header inherits the most recent earlier date/shift, but an existing
 * snapshot is never re-sourced, so later edits cannot rewrite history.
 */
export async function getOrCreateDateScopedSetups({
  setupModel,
  headerModel,
  headerId,
  machineIds = null
}) {
  if (!headerId) {
    // Legacy callers (master lookup/add-machine flows) use the baseline rows.
    return setupModel.findMany({
      where: { entry_date: new Date('1970-01-01T00:00:00.000Z'), shift: 1 },
      orderBy: { machine_id: 'asc' }
    })
  }

  const header = await headerModel.findUnique({
    where: { id: headerId },
    select: { entry_date: true, shift: true }
  })
  if (!header) throw new Error(`Production header ${headerId} not found`)

  const entryDate = header.entry_date
  const shift = Number(header.shift)
  const machineFilter = machineIds ? { machine_id: { in: machineIds } } : {}
  let targetRows = await setupModel.findMany({
    where: { ...machineFilter, entry_date: entryDate, shift },
    orderBy: { machine_id: 'asc' }
  })

  const existingIds = new Set(targetRows.map(row => row.machine_id))
  const missingIds = machineIds?.filter(id => !existingIds.has(id)) || []
  if (targetRows.length && !missingIds.length) return targetRows

  const idsToMaterialize = targetRows.length ? missingIds : machineIds
  const sourceRows = (await Promise.all((idsToMaterialize || []).map(machineId =>
    setupModel.findFirst({
      where: {
        machine_id: machineId,
        OR: [
          { entry_date: { lt: entryDate } },
          { entry_date: entryDate, shift: { lt: shift } }
        ]
      },
      orderBy: [{ entry_date: 'desc' }, { shift: 'desc' }]
    })
  ))).filter(Boolean)

  if (sourceRows.length) {
    await setupModel.createMany({
      data: sourceRows.map(row => cloneData(row, entryDate, shift)),
      skipDuplicates: true
    })
    targetRows = await setupModel.findMany({
      where: { ...machineFilter, entry_date: entryDate, shift },
      orderBy: { machine_id: 'asc' }
    })
  }
  return targetRows
}
