import { prisma } from '@/lib/prisma'
import { buildSpinningCountSnapshot } from '@/lib/countMasterSnapshots'

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
      run_time: shiftTime
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
  countName,
  changeAfter,
  setupOverrides = {}
} = {}) {
  if (moduleName !== 'spinning') throw new Error('Count Change is supported only for Spinning entries')
  const models = ENTRY_MODELS.spinning
  const mixing = String(countName || '').trim()
  const elapsed = Number(changeAfter)
  if (!headerId || !setupId || !mixing) throw new Error('Entry, machine run, and new count are required')
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error('Change time must be zero or greater')

  return prisma.$transaction(async (tx) => {
    const header = await tx[models.header].findUnique({
      where: { id: headerId },
      select: { id: true, entry_date: true, shift: true, total_time: true, is_locked: true }
    })
    if (!header) throw new Error('Production entry not found')
    if (header.is_locked) throw new Error('This production entry is locked')

    const current = await tx[models.setup].findUnique({ where: { id: setupId } })
    if (!current || current.entry_date.getTime() !== header.entry_date.getTime() || Number(current.shift) !== Number(header.shift)) {
      throw new Error('Machine run is not part of this entry')
    }
    const latest = await tx[models.setup].findFirst({
      where: { machine_id: current.machine_id, entry_date: header.entry_date, shift: Number(header.shift), is_included: true },
      ...(models.supportsRuns ? { orderBy: { run_sequence: 'desc' } } : {})
    })
    if (latest?.id !== current.id) throw new Error('Only the latest count run can be changed')
    const currentMixing = String(current.count_name ?? current.prodn_mixing ?? '').trim()
    if (currentMixing === mixing) throw new Error('Select a different count')

    const totalTime = Number(header.total_time)
    if (!Number.isFinite(totalTime) || totalTime <= 0) throw new Error('Shift time is not configured for this entry')
    const precedingRuns = await tx.spinning_machine_setup.findMany({
      where: {
        machine_id: current.machine_id,
        entry_date: header.entry_date,
        shift: Number(header.shift),
        is_included: true,
        run_sequence: { lt: Number(current.run_sequence || 1) }
      },
      select: { run_time: true }
    })
    const precedingTime = precedingRuns.reduce((sum, row) => sum + Number(row.run_time || 0), 0)
    if (precedingTime + elapsed > totalTime) {
      throw new Error(`Combined count-run time cannot exceed the ${totalTime}-minute shift`)
    }
    const remaining = totalTime - precedingTime - elapsed
    const nextSequence = Number(current.run_sequence || 1) + 1
    const count = await tx.spinning_counts.findFirst({ where: { count_name: mixing, is_active: true } })
    if (!count) throw new Error('Selected spinning count is not active')
    const resolvedCountOverrides = buildSpinningCountSnapshot(count)
    const safeOverrides = selectSetupOverrides(models, { ...resolvedCountOverrides, ...setupOverrides })
    const setupData = Object.fromEntries(Object.entries(current).filter(([field]) => !RUN_SYSTEM_FIELDS.has(field)))

    await tx[models.setup].update({
      where: { id: current.id }, data: { [models.setupRuntimeField]: elapsed }
    })
    await tx[models.detail].updateMany({
      where: { header_id: header.id, machine_id: current.machine_id, run_sequence: Number(current.run_sequence || 1) },
      data: { [models.detailRuntimeField]: elapsed }
    })
    const currentDetails = await tx.spinning_production_detail.findMany({
      where: {
        header_id: header.id,
        machine_id: current.machine_id,
        run_sequence: Number(current.run_sequence || 1)
      },
      select: { id: true }
    })
    await tx.spinning_stoppage_entry.updateMany({
      where: { production_detail_id: { in: currentDetails.map(detail => detail.id) } },
      data: { run_time: elapsed }
    })
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
        header_id: header.id, machine_id: current.machine_id,
        run_sequence: nextSequence, [models.detailMixingField]: mixing,
        [models.detailRuntimeField]: remaining,
        ...(models.detailRuntimeField !== 'work_time' && { work_time: remaining })
      }
    })
    await tx.spinning_stoppage_entry.create({
      data: { production_detail_id: newDetail.id, run_time: remaining }
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
        ...(machineId ? { id: machineId } : { machine_no: String(machineNo).trim() })
      },
      orderBy: { is_active: 'desc' }
    })
    if (!machine) {
      throw new Error('Machine does not exist in Machine Master for this entry date')
    }

    const masterDefaults = selectSetupOverrides(models, buildSetupFromMachineMaster(moduleName, machine, header))
    const safeOverrides = {
      ...selectSetupOverrides(models, setupOverrides),
      // The selected Machine Master is authoritative for every value stored
      // there. Dialog fallbacks must never replace newly-created Master data.
      ...masterDefaults
    }
    let setup = await tx[models.setup].findFirst({
      where: {
        machine_id: machine.id,
        entry_date: header.entry_date,
        shift: Number(header.shift)
      },
      orderBy: { run_sequence: 'desc' }
    })

    if (setup) {
      if (setup.is_included) throw new Error('Machine is already part of this entry')
      setup = await tx[models.setup].update({
        where: { id: setup.id },
        data: { ...safeOverrides, is_included: true }
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
