import { prisma } from '../prisma'
import { buildTypedSearchWhere } from '../masterSearch'
import { machineRemovalDate } from '../machineLifecycle'

const machineCountSelect = { id: true, count_name: true }

function flattenMachineCount(machine) {
  if (!machine) return machine
  const { spinning_counts: count, ...data } = machine
  return { ...data, count_name: count?.count_name ?? null }
}

async function resolveActiveCount(db, countId) {
  if (!countId) return null
  const count = await db.spinning_counts.findUnique({
    where: { id: countId },
    select: { id: true, is_active: true }
  })
  if (!count?.is_active) throw new Error('Selected spinning count is not active')
  return count
}

function sortMachinesByNumber(machines) {
  return machines.sort((a, b) => {
    const aNum = parseInt(a.machine_no.replace(/[^0-9]/g, '')) || 0
    const bNum = parseInt(b.machine_no.replace(/[^0-9]/g, '')) || 0
    if (aNum !== bNum) return aNum - bNum

    const aHasLetter = /[A-Za-z]/.test(a.machine_no)
    const bHasLetter = /[A-Za-z]/.test(b.machine_no)
    if (!aHasLetter && bHasLetter) return -1
    if (aHasLetter && !bHasLetter) return 1
    return a.machine_no.localeCompare(b.machine_no)
  })
}

export async function getSpinningMachines() {
  const data = await prisma.spinning_machines.findMany({
    include: { spinning_counts: { select: machineCountSelect } }
  })
  const sorted = sortMachinesByNumber((data || []).map(flattenMachineCount))
  return sorted.sort((a, b) => {
    if (a.is_active === b.is_active) return 0
    return a.is_active ? -1 : 1
  })
}

export async function createSpinningMachine(machineData) {
  try {
    const processedData = { ...machineData }
    if (processedData.installed_date && typeof processedData.installed_date === 'string') {
      processedData.installed_date = new Date(processedData.installed_date)
    }
    await resolveActiveCount(prisma, processedData.count_id)

    const existingActive = await prisma.spinning_machines.findFirst({
      where: { machine_no: { equals: processedData.machine_no }, is_active: true }
    })
    if (existingActive) {
      throw new Error(`Machine ${processedData.machine_no} already exists and is active`)
    }

    const previousRevision = await prisma.spinning_machines.findFirst({
      where: { machine_no: { equals: processedData.machine_no } },
      orderBy: { updated_at: 'desc' },
      select: { sort_order: true }
    })
    const maxSortResult = previousRevision
      ? null
      : await prisma.spinning_machines.aggregate({ _max: { sort_order: true } })
    const nextSortOrder = previousRevision?.sort_order ?? ((maxSortResult?._max.sort_order ?? 0) + 1)

    const machine = await prisma.spinning_machines.create({
      data: {
        ...processedData,
        is_active: processedData.is_active ?? true,
        activated_at: new Date(),
        deactivated_at: null,
        sort_order: nextSortOrder
      },
      include: { spinning_counts: { select: machineCountSelect } }
    })
    return flattenMachineCount(machine)
  } catch (error) {
    console.error('Prisma error creating spinning machine:', error)
    throw new Error(error.message || 'Failed to create spinning machine')
  }
}

export async function updateSpinningMachine(id, machineData) {
  const processedData = { ...machineData }
  if (processedData.installed_date && typeof processedData.installed_date === 'string') {
    processedData.installed_date = new Date(processedData.installed_date)
  }

  const currentMachine = await prisma.spinning_machines.findUnique({ where: { id } })
  if (!currentMachine) throw new Error('Spinning machine not found')
  if (currentMachine.is_active === false) throw new Error('Removed machines cannot be changed or restored')
  if (Object.hasOwn(processedData, 'count_id')) {
    await resolveActiveCount(prisma, processedData.count_id)
  }

  const changedKeys = Object.keys(processedData).filter(key => processedData[key] !== currentMachine[key])
  const isStatusOnly = changedKeys.every(key => ['is_active', 'activated_at', 'deactivated_at'].includes(key))
  const isActivating = processedData.is_active === true && currentMachine.is_active !== true
  const isDeactivating = processedData.is_active === false && currentMachine.is_active !== false

  if (isStatusOnly) {
    const updated = await prisma.spinning_machines.update({
      where: { id },
      data: {
        ...processedData,
        ...(isActivating && { activated_at: new Date(), deactivated_at: null }),
        ...(isDeactivating && { deactivated_at: machineRemovalDate() })
      },
      include: { spinning_counts: { select: machineCountSelect } }
    })
    return flattenMachineCount(updated)
  }

  const revisionFields = [
    'machine_no', 'sort_order', 'description', 'make_name', 'allocated_spindles',
    'speed', 'count_id', 'remarks', 'frame_no', 'mc_id', 'model', 'group_no',
    'installed_date', 'production_kgs_manual_entry', 'direct_hank_entry'
  ]
  const replacementData = Object.fromEntries(
    revisionFields.map(key => [
      key,
      Object.hasOwn(processedData, key) ? processedData[key] : currentMachine[key]
    ])
  )
  const revisionTime = new Date()

  return prisma.$transaction(async tx => {
    await tx.spinning_machines.update({
      where: { id },
      data: { is_active: false, deactivated_at: revisionTime }
    })
    const replacement = await tx.spinning_machines.create({
      data: {
        ...replacementData,
        is_active: true,
        activated_at: revisionTime,
        deactivated_at: null
      },
      include: { spinning_counts: { select: machineCountSelect } }
    })
    return flattenMachineCount(replacement)
  })
}

export async function getSpinningMachineWithSetup(id) {
  const machine = await prisma.spinning_machines.findUnique({
    where: { id },
    include: { spinning_counts: { select: machineCountSelect } }
  })
  return flattenMachineCount(machine)
}

export async function activateSpinningMachine(id) {
  const machine = await prisma.spinning_machines.findUnique({ where: { id } })
  if (!machine || machine.is_active === true) return machine
  return prisma.spinning_machines.update({
    where: { id },
    data: { is_active: true, activated_at: new Date(), deactivated_at: null }
  })
}

export async function deleteSpinningMachine(id) {
  await prisma.spinning_machines.delete({ where: { id } })
  return true
}

export async function searchSpinningMachines(field, condition, value) {
  const whereClause = buildTypedSearchWhere(field, condition, value, {
    machine_no: 'text', description: 'text', make_name: 'text'
  })
  const data = await prisma.spinning_machines.findMany({
    where: whereClause,
    include: { spinning_counts: { select: machineCountSelect } }
  })
  return sortMachinesByNumber((data || []).map(flattenMachineCount))
}
