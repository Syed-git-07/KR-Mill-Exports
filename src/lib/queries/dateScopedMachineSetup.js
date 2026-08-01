const SYSTEM_FIELDS = new Set(['id', 'created_at', 'updated_at', 'entry_date', 'shift'])

function numberOrFallback(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function buildMachineSetupOverrides(machine, fieldMap) {
  if (!machine) return {}
  return Object.fromEntries(
    Object.entries(fieldMap)
      .map(([setupField, machineField]) => [setupField, machine[machineField]])
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
  )
}

export function cloneDateScopedSetup(row, entryDate, shift, setupOverrides = {}) {
  const cloned = Object.fromEntries([
    ...Object.entries(row)
      .filter(([key]) => !SYSTEM_FIELDS.has(key)),
    ['entry_date', entryDate],
    ['shift', shift]
  ])

  Object.assign(cloned, setupOverrides)

  // Recalculate derived standard production from the complete effective
  // snapshot. Explicit zero master values must remain zero rather than being
  // replaced by legacy defaults.
  if ('std_prodn' in row) {
    const speed = numberOrFallback(cloned.speed, 0)
    const divisorConstant = numberOrFallback(cloned.divisor_constant, 1693)
    const hankConstant = numberOrFallback(cloned.hank_constant, 0.14)
    const stdEfficiencyFactor = numberOrFallback(cloned.std_efficiency_factor, 0.85)
    const delivery = numberOrFallback(cloned.delivery, 1)
    const shiftTime = numberOrFallback(cloned.shift_time, 510)

    cloned.std_prodn = hankConstant > 0 && divisorConstant > 0
      ? Math.round((speed / divisorConstant / hankConstant) * shiftTime * stdEfficiencyFactor * delivery * 100) / 100
      : 0
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
  machineSpeedMap = null,
  machineSetupOverridesMap = null
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
    select: { entry_date: true, shift: true, total_time: true }
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
        const overrides = {
          ...(machineSetupOverridesMap?.[row.machine_id] || {})
        }
        const defaultSpeed = machineSpeedMap?.[row.machine_id]
        if ('speed' in row && defaultSpeed !== null && defaultSpeed !== undefined) {
          overrides.speed = defaultSpeed
        }
        if ('shift_time' in row && header.total_time !== null && header.total_time !== undefined) {
          overrides.shift_time = header.total_time
        }
        return cloneDateScopedSetup(row, entryDate, shift, overrides)
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
