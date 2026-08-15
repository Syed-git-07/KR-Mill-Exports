import { prisma } from '@/lib/prisma'

const ENTRY_MODELS = {
  carding: {
    header: 'carding_production_header',
    machine: 'carding_machines',
    setup: 'carding_machine_setup',
    detail: 'carding_production_detail',
    stoppage: 'carding_stoppage_entry',
    detailMixingField: 'count_mixing',
    setupFields: ['speed', 'hank_constant', 'std_efficiency_factor', 'default_waste', 'std_prodn', 'shift_time', 'default_stoppage', 'divisor_constant', 'prodn_mixing']
  },
  breakerDrawing: {
    header: 'breaker_drawing_production_header',
    machine: 'drawing_breaker_machines',
    setup: 'breaker_drawing_machine_setup',
    detail: 'breaker_drawing_production_detail',
    stoppage: 'breaker_drawing_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['speed', 'hank_constant', 'std_efficiency_factor', 'default_waste', 'std_prodn', 'shift_time', 'default_stoppage', 'divisor_constant', 'delivery', 'prodn_mixing']
  },
  comber: {
    header: 'comber_production_header',
    machine: 'comber_machines',
    setup: 'comber_machine_setup',
    detail: 'comber_production_detail',
    stoppage: 'comber_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['prodn_mixing', 'session_no', 'cc_time', 'sl_hank', 'mc_effi', 'shift_time', 'default_waste', 'constant', 'description', 'speed']
  },
  finisherDrawing: {
    header: 'finisher_drawing_production_header',
    machine: 'drawing_finisher_machines',
    setup: 'finisher_drawing_machine_setup',
    detail: 'finisher_drawing_production_detail',
    stoppage: 'finisher_drawing_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['speed', 'hank_constant', 'std_efficiency_factor', 'default_waste', 'std_prodn', 'shift_time', 'default_stoppage', 'divisor_constant', 'delivery', 'make_name', 'machine_type', 'prodn_mixing']
  },
  lapFormer: {
    header: 'lap_former_production_header',
    machine: 'lap_former_machines',
    setup: 'lap_former_machine_setup',
    detail: 'lap_former_production_detail',
    stoppage: 'lap_former_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['speed', 'hank_constant', 'std_efficiency_factor', 'default_waste', 'std_prodn', 'shift_time', 'default_stoppage', 'divisor_constant', 'delivery', 'prodn_mixing']
  },
  simplex: {
    header: 'simplex_production_header',
    machine: 'simplex_machines',
    setup: 'simplex_machine_setup',
    detail: 'simplex_production_detail',
    stoppage: 'simplex_stoppage_entry',
    detailMixingField: 'prodn_mixing',
    setupFields: ['prodn_mixing', 'session_no', 'cc_time', 'sl_hank', 'mc_effi', 'tpi', 'spindles', 'shift_time', 'default_waste', 'speed']
  },
  spinning: {
    header: 'spinning_production_header',
    machine: 'spinning_machines',
    setup: 'spinning_machine_setup',
    detail: 'spinning_production_detail',
    stoppage: 'spinning_stoppage_entry',
    setupFields: ['count_name', 'count_id', 'act_count', 'tpi', 'allocated_spindles', 'tw_con', 'doff_loss', 'c_waste_percent', 'conv_40s_value', 'speed', 'session_no', 'run_time', 'efficiency', 'conversion_factor']
  },
  autoconer: {
    header: 'autoconer_production_header',
    machine: 'autoconer_machines',
    setup: 'autoconer_machine_setup',
    detail: 'autoconer_production_detail',
    stoppage: 'autoconer_stoppage_entry',
    setupFields: ['count_name', 'count_id', 'act_count', 'session_no', 'run_time', 'speed', 'target_effi']
  }
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
        ...(machineId ? { id: machineId } : { machine_no: String(machineNo).trim() }),
        AND: [
          { OR: [{ activated_at: null }, { activated_at: { lte: header.entry_date } }] },
          { OR: [{ deactivated_at: null }, { deactivated_at: { gt: header.entry_date } }] }
        ]
      }
    })
    if (!machine) {
      throw new Error('Machine does not exist in Machine Master for this entry date')
    }

    const safeOverrides = selectSetupOverrides(models, setupOverrides)
    let setup = await tx[models.setup].findFirst({
      where: {
        machine_id: machine.id,
        entry_date: header.entry_date,
        shift: Number(header.shift)
      }
    })

    if (setup) {
      setup = await tx[models.setup].update({
        where: { id: setup.id },
        data: { ...safeOverrides, is_included: true }
      })
    } else {
      const source = await tx[models.setup].findFirst({
        where: {
          machine_id: machine.id,
          OR: [
            { entry_date: { lt: header.entry_date } },
            { entry_date: header.entry_date, shift: { lt: Number(header.shift) } }
          ]
        },
        orderBy: [{ entry_date: 'desc' }, { shift: 'desc' }]
      })
      const inherited = source
        ? Object.fromEntries(
            Object.entries(source).filter(
              ([field]) => !['id', 'created_at', 'updated_at', 'entry_date', 'shift', 'machine_id', 'is_included'].includes(field)
            )
          )
        : {}

      setup = await tx[models.setup].create({
        data: {
          ...inherited,
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
 * Removes one machine from exactly one dated production-entry snapshot.
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

    await tx[models.setup].update({
      where: { id: setup.id },
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
