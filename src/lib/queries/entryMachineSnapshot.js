import { prisma } from '@/lib/prisma'
import { buildSpinningCountSnapshot } from '@/lib/countMasterSnapshots'
import { machineAvailableOnDateWhere, machineIdentifierWhere } from '@/lib/machineLifecycle'

const ENTRY_MODELS = {
  carding: {
    header: 'carding_production_header',
    machine: 'carding_machines',
    setup: 'carding_machine_setup',
    detail: 'carding_production_detail',
    stoppage: 'carding_stoppage_entry',
    detailMixingField: 'count_mixing',
    setupFields: ['speed', 'hank_constant', 'std_efficiency_factor', 'default_waste', 'std_prodn', 'shift_time', 'default_stoppage', 'divisor_constant', 'prodn_mixing'],
    setupRuntimeField: 'shift_time', detailRuntimeField: 'run_time'
  },
  breakerDrawing: {
    header: 'breaker_drawing_production_header',
    machine: 'drawing_breaker_machines',
    setup: 'breaker_drawing_machine_setup',
    detail: 'breaker_drawing_production_detail',
    stoppage: 'breaker_drawing_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['speed', 'hank_constant', 'std_efficiency_factor', 'default_waste', 'std_prodn', 'shift_time', 'default_stoppage', 'divisor_constant', 'delivery', 'prodn_mixing'],
    setupRuntimeField: 'shift_time', detailRuntimeField: 'run_time'
  },
  comber: {
    header: 'comber_production_header',
    machine: 'comber_machines',
    setup: 'comber_machine_setup',
    detail: 'comber_production_detail',
    stoppage: 'comber_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['prodn_mixing', 'session_no', 'cc_time', 'sl_hank', 'mc_effi', 'shift_time', 'default_waste', 'constant', 'description', 'speed'],
    setupRuntimeField: 'shift_time', detailRuntimeField: 'run_min'
  },
  finisherDrawing: {
    header: 'finisher_drawing_production_header',
    machine: 'drawing_finisher_machines',
    setup: 'finisher_drawing_machine_setup',
    detail: 'finisher_drawing_production_detail',
    stoppage: 'finisher_drawing_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['speed', 'hank_constant', 'std_efficiency_factor', 'default_waste', 'std_prodn', 'shift_time', 'default_stoppage', 'divisor_constant', 'delivery', 'make_name', 'machine_type', 'prodn_mixing'],
    setupRuntimeField: 'shift_time', detailRuntimeField: 'run_time'
  },
  lapFormer: {
    header: 'lap_former_production_header',
    machine: 'lap_former_machines',
    setup: 'lap_former_machine_setup',
    detail: 'lap_former_production_detail',
    stoppage: 'lap_former_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['speed', 'hank_constant', 'std_efficiency_factor', 'default_waste', 'std_prodn', 'shift_time', 'default_stoppage', 'divisor_constant', 'delivery', 'prodn_mixing'],
    setupRuntimeField: 'shift_time', detailRuntimeField: 'run_time'
  },
  simplex: {
    header: 'simplex_production_header',
    machine: 'simplex_machines',
    setup: 'simplex_machine_setup',
    detail: 'simplex_production_detail',
    stoppage: 'simplex_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['prodn_mixing', 'session_no', 'cc_time', 'sl_hank', 'mc_effi', 'tpi', 'spindles', 'shift_time', 'default_waste', 'speed'],
    setupRuntimeField: 'shift_time', detailRuntimeField: 'run_time'
  },
  spinning: {
    header: 'spinning_production_header',
    machine: 'spinning_machines',
    setup: 'spinning_machine_setup',
    detail: 'spinning_production_detail',
    stoppage: 'spinning_stoppage_entry',
    setupFields: ['count_name', 'count_id', 'act_count', 'tpi', 'allocated_spindles', 'tw_con', 'doff_loss', 'c_waste_percent', 'conv_40s_value', 'speed', 'session_no', 'run_time', 'efficiency', 'conversion_factor'],
    setupRuntimeField: 'run_time', detailRuntimeField: 'run_time', detailMixingField: 'count_name', supportsRuns: true
  },
  autoconer: {
    header: 'autoconer_production_header',
    machine: 'autoconer_machines',
    setup: 'autoconer_machine_setup',
    detail: 'autoconer_production_detail',
    stoppage: 'autoconer_stoppage_entry',
    setupFields: ['count_name', 'count_id', 'act_count', 'session_no', 'run_time', 'speed', 'target_effi'],
    setupRuntimeField: 'run_time', detailRuntimeField: 'run_time', detailMixingField: 'count_name'
  }
}

const RUN_SYSTEM_FIELDS = new Set(['id', 'created_at', 'updated_at', 'entry_date', 'shift', 'run_sequence'])
const ENTRY_STRUCTURE_FIELDS = new Set(['prodn_mixing', 'count_id', 'count_name'])

const present = (value) => value !== null && value !== undefined && value !== ''
const efficiencyFactor = (value) => {
  if (!present(value)) return undefined
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return undefined
  return numeric > 1 ? numeric / 100 : numeric
}

function buildSetupFromMachineMaster(moduleName, machine, header) {
  const shiftTime = Number(header.shift) === 3 ? 420 : 510
  const commonDrawing = {
    speed: machine.speed,
    std_efficiency_factor: efficiencyFactor(machine.prodn_efficiency),
    prodn_mixing: machine.prodn_mixing,
    shift_time: shiftTime
  }

  const values = {
    carding: { ...commonDrawing, hank_constant: machine.hank_constant },
    breakerDrawing: { ...commonDrawing, hank_constant: machine.sliver_hank, delivery: machine.delivery },
    comber: {
      speed: machine.speed,
      prodn_mixing: machine.prodn_mixing,
      sl_hank: machine.sliver_hank,
      mc_effi: present(machine.mc_effi) ? machine.mc_effi : machine.prodn_efficiency,
      shift_time: shiftTime
    },
    finisherDrawing: { ...commonDrawing, make_name: machine.make_name },
    lapFormer: commonDrawing,
    simplex: {
      speed: machine.speed,
      prodn_mixing: machine.prodn_mixing,
      mc_effi: present(machine.mc_effi) ? machine.mc_effi : machine.prodn_efficiency,
      tpi: machine.tpi,
      spindles: machine.no_of_spindles,
      shift_time: shiftTime
    },
    spinning: {
      count_id: machine.count_id,
      count_name: machine.spinning_counts?.count_name,
      allocated_spindles: machine.allocated_spindles,
      speed: machine.speed,
      run_time: shiftTime,
      efficiency: 0.95,
      conversion_factor: 2.20456
    },
    autoconer: {
      count_id: machine.count_id,
      count_name: machine.count,
      speed: machine.speed,
      target_effi: machine.act_effi,
      run_time: shiftTime
    }
  }[moduleName] || {}

  return Object.fromEntries(Object.entries(values).filter(([, value]) => present(value)))
}

export async function changeEntryMachineCountRun(moduleName, headerId, setupId, {
  countId,
  countName,
  changeAfter,
  setupOverrides = {}
} = {}) {
  if (moduleName !== 'spinning') throw new Error('Count Change is supported only for Spinning entries')
  const models = ENTRY_MODELS.spinning
  const elapsed = Number(changeAfter)
  if (!headerId || !setupId || !countId) throw new Error('Entry, machine run, and new count are required')
  if (!Number.isFinite(elapsed) || elapsed <= 0) throw new Error('Current count run time must be greater than zero')

  return prisma.$transaction(async (tx) => {
    const header = await tx[models.header].findUnique({
      where: { id: headerId },
      select: { id: true, entry_date: true, shift: true, total_time: true, is_locked: true }
    })
    if (!header) throw new Error('Production entry not found')
    if (header.is_locked) throw new Error('This production entry is locked')

    const current = await tx[models.setup].findUnique({ where: { id: setupId } })
    if (!current || current.is_included !== true || current.entry_date.getTime() !== header.entry_date.getTime() || Number(current.shift) !== Number(header.shift)) {
      throw new Error('Machine run is not part of this entry')
    }
    const latest = await tx[models.setup].findFirst({
      where: { machine_id: current.machine_id, entry_date: header.entry_date, shift: Number(header.shift), is_included: true },
      ...(models.supportsRuns ? { orderBy: { run_sequence: 'desc' } } : {})
    })
    if (latest?.id !== current.id) throw new Error('Only the latest count run can be changed')
    const currentRuntime = Number(current.run_time)
    if (!Number.isFinite(currentRuntime) || currentRuntime <= 0) {
      throw new Error('Current count run time is not configured')
    }
    const allRuns = await tx.spinning_machine_setup.findMany({
      where: {
        machine_id: current.machine_id,
        entry_date: header.entry_date,
        shift: Number(header.shift),
        is_included: true
      },
      select: { run_time: true }
    })
    const allocatedRuntime = allRuns.reduce((sum, run) => sum + Number(run.run_time || 0), 0)
    const totalTime = Number(header.total_time)
    if (!Number.isFinite(totalTime) || totalTime <= 0) {
      throw new Error('Shift time is not configured for this entry')
    }
    if (allocatedRuntime !== totalTime) {
      throw new Error(`Count-run minutes total ${allocatedRuntime}; update them to the ${totalTime}-minute shift before splitting again`)
    }
    if (elapsed >= currentRuntime) {
      throw new Error(`Current count run time must be less than ${currentRuntime} minutes so the new count has time to run`)
    }
    const remaining = currentRuntime - elapsed
    const nextSequence = Number(current.run_sequence || 1) + 1
    const count = await tx.spinning_counts.findFirst({ where: { id: countId, is_active: true } })
    if (!count) throw new Error('Selected spinning count is not active')
    if (
      String(current.count_id || '') === String(count.id) ||
      String(current.count_name || '').trim() === String(count.count_name || '').trim()
    ) {
      throw new Error('Select a different count')
    }
    if (countName && String(countName).trim() !== String(count.count_name).trim()) {
      throw new Error('Selected count no longer matches Count Master; refresh and try again')
    }
    const resolvedCountOverrides = buildSpinningCountSnapshot(count)
    const safeOverrides = selectSetupOverrides(models, {
      ...resolvedCountOverrides,
      ...setupOverrides,
      count_id: count.id,
      count_name: count.count_name
    })
    const setupData = Object.fromEntries(Object.entries(current).filter(([field]) => !RUN_SYSTEM_FIELDS.has(field)))

    const currentDetail = await tx.spinning_production_detail.findFirst({
      where: {
        header_id: header.id,
        machine_id: current.machine_id,
        run_sequence: Number(current.run_sequence || 1)
      }
    })
    if (!currentDetail) throw new Error('Production row for this machine run is missing; refresh the entry before changing count')
    const currentStoppage = await tx.spinning_stoppage_entry.findUnique({
      where: { production_detail_id: currentDetail.id }
    })
    const currentStoppageTime = Number(currentStoppage?.total_stoppage_time || 0)
    if (currentStoppageTime > elapsed) {
      throw new Error(`Current run already has ${currentStoppageTime} stoppage minutes; its run time cannot be reduced to ${elapsed}`)
    }

    await tx[models.setup].update({
      where: { id: current.id }, data: { [models.setupRuntimeField]: elapsed }
    })
    await tx[models.detail].update({
      where: { id: currentDetail.id },
      data: {
        [models.detailRuntimeField]: elapsed,
        work_time: elapsed - currentStoppageTime
      }
    })
    if (currentStoppage) {
      await tx.spinning_stoppage_entry.update({
        where: { id: currentStoppage.id },
        data: { run_time: elapsed }
      })
    } else {
      await tx.spinning_stoppage_entry.create({
        data: { production_detail_id: currentDetail.id, run_time: elapsed }
      })
    }
    const newSetup = await tx[models.setup].create({
      data: {
        ...setupData, ...safeOverrides,
        machine_id: current.machine_id, entry_date: header.entry_date,
        shift: Number(header.shift), run_sequence: nextSequence,
        [models.setupRuntimeField]: remaining, is_included: true
      }
    })
    const newDetail = await tx[models.detail].create({
      data: {
        header_id: header.id,
        machine_id: current.machine_id,
        run_sequence: nextSequence,
        [models.detailMixingField]: count.count_name,
        [models.detailRuntimeField]: remaining,
        work_time: remaining,
        session_no: currentDetail.session_no ?? current.session_no ?? 1,
        total_stoppage_mins: 0,
        stopped_spindles: 0
      }
    })
    await tx.spinning_stoppage_entry.create({
      data: {
        production_detail_id: newDetail.id,
        run_time: remaining,
        stoppage1_time: 0,
        stoppage2_time: 0,
        stoppage3_time: 0,
        stoppage4_time: 0,
        total_stoppage_time: 0
      }
    })
    return { previousSetupId: current.id, setup: newSetup, detail: newDetail }
  })
}

function selectSetupOverrides(models, values = {}) {
  return Object.fromEntries(
    Object.entries(values || {}).filter(
      ([field, value]) => models.setupFields.includes(field) && value !== undefined
    )
  )
}

export async function updateEntryMixingSnapshot(
  moduleName,
  headerId,
  machineIds,
  prodnMixing,
  setupOverrides = {}
) {
  const models = ENTRY_MODELS[moduleName]
  const ids = [...new Set((machineIds || []).filter(Boolean))]
  const mixing = String(prodnMixing || '').trim()
  if (!models?.detailMixingField) throw new Error(`Count/mixing is not supported for ${moduleName}`)
  if (!headerId || ids.length === 0 || !mixing) {
    throw new Error('Entry, machine selection, and count/mixing are required')
  }

  return prisma.$transaction(async (tx) => {
    const header = await tx[models.header].findUnique({
      where: { id: headerId },
      select: { entry_date: true, shift: true, is_locked: true }
    })
    if (!header) throw new Error('Entry not found')
    if (header.is_locked) throw new Error('This entry is locked and cannot be changed')

    const [setups, details] = await Promise.all([
      tx[models.setup].updateMany({
        where: {
          machine_id: { in: ids },
          entry_date: header.entry_date,
          shift: header.shift,
          is_included: true
        },
        data: {
          ...selectSetupOverrides(models, setupOverrides),
          prodn_mixing: mixing
        }
      }),
      tx[models.detail].updateMany({
        where: { header_id: headerId, machine_id: { in: ids } },
        data: { [models.detailMixingField]: mixing }
      })
    ])

    return { setups: setups.count, details: details.count }
  })
}

/**
 * Adds an existing Machine Master record to one entry snapshot. It never
 * creates, reactivates, or edits the master record.
 */
export async function addMachineToEntrySnapshot(moduleName, headerId, {
  machineId = null,
  machineNo = null,
  setupOverrides = {}
} = {}) {
  const models = ENTRY_MODELS[moduleName]
  if (!models) throw new Error(`Unsupported entry module: ${moduleName}`)
  if (!headerId || (!machineId && !String(machineNo || '').trim())) {
    throw new Error('Entry and existing machine are required')
  }

  return prisma.$transaction(async (tx) => {
    const header = await tx[models.header].findUnique({
      where: { id: headerId },
      select: { id: true, entry_date: true, shift: true, is_locked: true }
    })
    if (!header) throw new Error('Production entry not found')
    if (header.is_locked) throw new Error('This production entry is locked')

    const machine = await tx[models.machine].findFirst({
      where: {
        ...(machineId ? { id: machineId } : machineIdentifierWhere(machineNo)),
        ...machineAvailableOnDateWhere(header.entry_date)
      },
      orderBy: [{ is_active: 'desc' }, { updated_at: 'desc' }],
      ...(['spinning', 'autoconer'].includes(moduleName)
        ? { include: { spinning_counts: true } }
        : {})
    })
    if (!machine) {
      throw new Error('Machine does not exist in Machine Master for this entry date')
    }

    const requestedOverrides = selectSetupOverrides(models, setupOverrides)
    const masterDefaults = selectSetupOverrides(models, buildSetupFromMachineMaster(moduleName, machine, header))
    const requestedStructure = Object.fromEntries(
      Object.entries(requestedOverrides).filter(
        ([field, value]) => ENTRY_STRUCTURE_FIELDS.has(field) && present(value)
      )
    )
    const safeOverrides = {
      ...requestedOverrides,
      // The selected Machine Master is authoritative for every value stored
      // there. Entry-owned count/mixing remains the user's explicit structural
      // choice and is allowed to override the Master's default selection.
      ...masterDefaults,
      ...requestedStructure
    }
    const setupRows = await tx[models.setup].findMany({
      where: {
        machine_id: machine.id,
        entry_date: header.entry_date,
        shift: Number(header.shift)
      },
      orderBy: { run_sequence: 'asc' }
    })

    if (setupRows.some(row => row.is_included)) {
      throw new Error('Machine is already part of this entry')
    }

    let setup
    if (setupRows.length > 0) {
      // Remove leaves every count run as an exclusion marker. Re-adding the
      // physical machine must start a clean single-run snapshot at sequence 1;
      // otherwise setup/detail sequence keys no longer line up.
      const retained = setupRows.find(row => Number(row.run_sequence || 1) === 1) || setupRows[0]
      const redundantIds = setupRows.filter(row => row.id !== retained.id).map(row => row.id)
      if (redundantIds.length > 0) {
        await tx[models.setup].deleteMany({ where: { id: { in: redundantIds } } })
      }

      const staleDetails = await tx[models.detail].findMany({
        where: { header_id: header.id, machine_id: machine.id },
        select: { id: true }
      })
      const staleDetailIds = staleDetails.map(row => row.id)
      if (staleDetailIds.length > 0) {
        await tx[models.stoppage].deleteMany({
          where: { production_detail_id: { in: staleDetailIds } }
        })
        await tx[models.detail].deleteMany({ where: { id: { in: staleDetailIds } } })
      }

      setup = await tx[models.setup].update({
        where: { id: retained.id },
        data: { ...safeOverrides, run_sequence: 1, is_included: true }
      })
    } else {
      setup = await tx[models.setup].create({
        data: {
          ...safeOverrides,
          machine_id: machine.id,
          entry_date: header.entry_date,
          shift: Number(header.shift),
          is_included: true
        }
      })
    }

    return { machine, setup, header }
  })
}

/**
 * Removes one machine from this dated snapshot and records the exclusion so
 * newly initialized entries continue to exclude it until explicitly re-added.
 * Machine Master is intentionally never updated here.  The dated setup row is
 * retained as an exclusion marker so load/sync code cannot silently recreate
 * the machine in the same entry.
 */
export async function removeMachineFromEntrySnapshot(moduleName, headerId, machineId) {
  const models = ENTRY_MODELS[moduleName]
  if (!models) throw new Error(`Unsupported entry module: ${moduleName}`)
  if (!headerId || !machineId) throw new Error('Entry and machine are required')

  return prisma.$transaction(async (tx) => {
    const header = await tx[models.header].findUnique({
      where: { id: headerId },
      select: { id: true, entry_date: true, shift: true, is_locked: true }
    })
    if (!header) throw new Error('Production entry not found')
    if (header.is_locked) throw new Error('This production entry is locked')

    const setup = await tx[models.setup].findFirst({
      where: {
        machine_id: machineId,
        entry_date: header.entry_date,
        shift: Number(header.shift)
      },
      select: { id: true }
    })
    if (!setup) throw new Error('Machine setup is not part of this entry')

    await tx[models.setup].updateMany({
      where: {
        machine_id: machineId,
        entry_date: header.entry_date,
        shift: Number(header.shift)
      },
      data: { is_included: false }
    })

    const detailIds = await tx[models.detail].findMany({
      where: { header_id: header.id, machine_id: machineId },
      select: { id: true }
    })
    const ids = detailIds.map((row) => row.id)
    if (ids.length) {
      await tx[models.stoppage].deleteMany({
        where: { production_detail_id: { in: ids } }
      })
      await tx[models.detail].deleteMany({
        where: { id: { in: ids } }
      })
    }

    return { header_id: header.id, machine_id: machineId, setup_id: setup.id }
  })
}

function getEntryModels(moduleName) {
  const models = ENTRY_MODELS[moduleName]
  if (!models) throw new Error(`Unsupported entry module: ${moduleName}`)
  return models
}

export async function assertEntryHeaderUnlocked(moduleName, headerId) {
  const models = getEntryModels(moduleName)
  const header = await prisma[models.header].findUnique({
    where: { id: headerId },
    select: { id: true, is_locked: true }
  })
  if (!header) throw new Error('Production entry not found')
  if (header.is_locked) throw new Error('This production entry is locked')
  return header
}

export async function assertEntryDetailUnlocked(moduleName, detailId) {
  const models = getEntryModels(moduleName)
  const detail = await prisma[models.detail].findUnique({
    where: { id: detailId },
    select: { header_id: true }
  })
  if (!detail) throw new Error('Production detail not found')
  await assertEntryHeaderUnlocked(moduleName, detail.header_id)
  return detail
}

export async function assertEntryStoppageUnlocked(moduleName, stoppageId) {
  const models = getEntryModels(moduleName)
  const stoppage = await prisma[models.stoppage].findUnique({
    where: { id: stoppageId },
    select: { production_detail_id: true }
  })
  if (!stoppage) throw new Error('Stoppage entry not found')
  await assertEntryDetailUnlocked(moduleName, stoppage.production_detail_id)
  return stoppage
}

export async function assertEntrySetupUnlocked(moduleName, setupId) {
  const models = getEntryModels(moduleName)
  const setup = await prisma[models.setup].findUnique({
    where: { id: setupId },
    select: { entry_date: true, shift: true }
  })
  if (!setup) throw new Error('Machine setup not found')

  const lockedHeader = await prisma[models.header].findFirst({
    where: {
      entry_date: setup.entry_date,
      shift: Number(setup.shift),
      is_locked: true
    },
    select: { id: true }
  })
  if (lockedHeader) throw new Error('This production entry is locked')
  return setup
}
