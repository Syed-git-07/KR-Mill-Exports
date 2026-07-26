const SYSTEM_FIELDS = new Set(['id', 'created_at', 'updated_at', 'entry_date', 'shift'])

function cloneData(row, entryDate, shift, defaultSpeed = null) {
  const cloned = Object.fromEntries([
    ...Object.entries(row)
      .filter(([key]) => !SYSTEM_FIELDS.has(key)),
    ['entry_date', entryDate],
    ['shift', shift]
  ])

  if (defaultSpeed !== null && defaultSpeed !== undefined && 'speed' in row) {
    cloned.speed = defaultSpeed

    // Recalculate std_prodn for models that have it (breaker_drawing_machine_setup, finisher_drawing_machine_setup, lap_former_machine_setup)
    if ('std_prodn' in row) {
      const speed = Number(defaultSpeed)
      const divisorConstant = Number(cloned.divisor_constant || 1693)
      const hankConstant = Number(cloned.hank_constant || 0.14)
      const stdEfficiencyFactor = Number(cloned.std_efficiency_factor || 0.85)
      const delivery = Number(cloned.delivery || 1)
      const shiftTime = Number(cloned.shift_time || 510)

      if (hankConstant && divisorConstant) {
        cloned.std_prodn = Math.round((speed / divisorConstant / hankConstant) * shiftTime * stdEfficiencyFactor * delivery * 100) / 100
      }
    }
  }

  return cloned
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
  machineIds = null,
  machineSpeedMap = null
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
      data: sourceRows.map(row => {
        const defaultSpeed = machineSpeedMap ? machineSpeedMap[row.machine_id] : null
        return cloneData(row, entryDate, shift, defaultSpeed)
      }),
      skipDuplicates: true
    })
    targetRows = await setupModel.findMany({
      where: { ...machineFilter, entry_date: entryDate, shift },
      orderBy: { machine_id: 'asc' }
    })
  }
  return targetRows
}
