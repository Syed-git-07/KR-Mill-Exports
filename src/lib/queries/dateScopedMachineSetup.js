const SYSTEM_FIELDS = new Set(['id', 'created_at', 'updated_at', 'entry_date', 'shift', 'run_sequence'])

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
  if ('run_sequence' in row) cloned.run_sequence = 1
  // Participation is carried forward independently from the live Machine
  // Master. Entry-side removal therefore remains effective until the machine
  // is explicitly added again from an entry.
  cloned.is_included = setupOverrides.is_included ?? (row.is_included !== false)

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
 * Return the newest earlier production entry that has a materialized setup
 * snapshot. A header can survive an interrupted initialization; treating that
 * empty shell as the previous format would incorrectly initialize the next
 * entry with zero machines.
 */
export async function findPreviousEntrySetupSnapshot({
  headerModel,
  setupModel,
  entryDate,
  shift
}) {
  const candidates = await headerModel.findMany({
    where: {
      OR: [
        { entry_date: { lt: entryDate } },
        { entry_date: entryDate, shift: { lt: Number(shift) } }
      ]
    },
    select: { entry_date: true, shift: true },
    orderBy: [{ entry_date: 'desc' }, { shift: 'desc' }]
  })

  for (const header of candidates) {
    const rows = await setupModel.findMany({
      where: {
        entry_date: header.entry_date,
        shift: Number(header.shift)
      },
      orderBy: [{ machine_id: 'asc' }, { run_sequence: 'desc' }]
    })
    if (rows.length > 0) return { header, rows }
  }

  return { header: null, rows: [] }
}

/**
 * Materializes an independent setup snapshot for one production header.
 * A new header inherits the most recent earlier date/shift, then overlays the
 * current machine-master values. An existing snapshot is never re-sourced, so
 * later master edits cannot rewrite history.
 */
export async function getOrCreateDateScopedSetups({
  setupModel,
  headerModel,
  headerId,
  machineIds = null,
  machineSetupOverridesMap = null,
  newMachineSetupDefaultsMap = null
}) {
  if (!headerId) {
    // Legacy callers (master lookup/add-machine flows) use the baseline rows.
    return setupModel.findMany({
      where: {
        entry_date: new Date('1970-01-01T00:00:00.000Z'),
        shift: 1,
        is_included: true
      },
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
  const allowedMachineIds = machineIds ? new Set(machineIds) : null
  const targetSnapshot = await setupModel.findMany({
    where: { entry_date: entryDate, shift },
    orderBy: { machine_id: 'asc' }
  })

  // Any row, including an exclusion marker, proves that this entry already has
  // its own snapshot. Reopening it must never merge in a later Master change or
  // a subsequent edit made to the source entry.
  if (targetSnapshot.length) {
    return targetSnapshot.filter(
      row => row.is_included && (!allowedMachineIds || allowedMachineIds.has(row.machine_id))
    )
  }

  // Membership must come from one exact prior entry. Looking up the latest row
  // separately for every machine can accidentally combine several historical
  // entries and reintroduce machines that were absent from the immediately
  // preceding structure.
  const previousSnapshot = await findPreviousEntrySetupSnapshot({
    headerModel,
    setupModel,
    entryDate,
    shift
  })
  const previousHeader = previousSnapshot.header

  let materializableRows = previousHeader
    ? previousSnapshot.rows
    : await setupModel.findMany({
        where: {
          ...machineFilter,
          entry_date: new Date('1970-01-01T00:00:00.000Z'),
          shift: 1
        },
        orderBy: { machine_id: 'asc' }
      })

  if (previousHeader) {
    const latestByMachine = new Map()
    for (const row of materializableRows) {
      if (!latestByMachine.has(row.machine_id)) latestByMachine.set(row.machine_id, row)
    }
    materializableRows = [...latestByMachine.values()]
  }

  // A permanent Master removal is effective for future entries, while a new
  // Master machine is not auto-enrolled when a prior entry already exists.
  if (!previousHeader) {
    materializableRows = materializableRows.filter(
      row => !allowedMachineIds || allowedMachineIds.has(row.machine_id)
    )
  }

  // On the first-ever entry only, tolerate legacy Master rows that do not have
  // a 1970 baseline setup. Once an entry exists, its exact membership is the
  // sole source of the next entry's structure.
  if (!previousHeader && machineIds?.length) {
    const sourceIds = new Set(materializableRows.map(row => row.machine_id))
    for (const machineId of machineIds) {
      if (sourceIds.has(machineId)) continue
      const defaults = newMachineSetupDefaultsMap?.[machineId]
      if (!defaults) continue
      materializableRows.push({
        ...defaults,
        ...(machineSetupOverridesMap?.[machineId] || {}),
        machine_id: machineId,
        is_included: true
      })
    }
  }

  if (materializableRows.length) {
    await setupModel.createMany({
      data: materializableRows.map(row => {
        const overrides = {}
        if ('shift_time' in row && header.total_time !== null && header.total_time !== undefined) {
          overrides.shift_time = header.total_time
        }
        return cloneDateScopedSetup(row, entryDate, shift, {
          ...overrides,
          ...(previousHeader && allowedMachineIds && !allowedMachineIds.has(row.machine_id)
            ? { is_included: false }
            : {}),
          ...(machineSetupOverridesMap?.[row.machine_id] || {})
        })
      }),
      skipDuplicates: true
    })
  }

  const createdSnapshot = await setupModel.findMany({
    where: { entry_date: entryDate, shift },
    orderBy: { machine_id: 'asc' }
  })
  return createdSnapshot.filter(
    row => row.is_included && (!allowedMachineIds || allowedMachineIds.has(row.machine_id))
  )
}
