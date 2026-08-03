import { parseStrictDate } from '../strictDate.js'

function lifecycleError(message, code = 'INVALID_ENTRY_MACHINE_LIFECYCLE') {
  const error = new Error(message)
  error.code = code
  return error
}

export function normalizeEntryMachineContext(context, label = 'Production entry') {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw lifecycleError(`${label} context is required`)
  }

  const headerId = String(context.headerId ?? '').trim()
  if (!headerId) throw lifecycleError(`${label} header is required`)

  const entryDate = parseStrictDate(context.entryDate, `${label} date`)
  const shift = Number(context.shift)
  if (!Number.isInteger(shift) || shift <= 0) {
    throw lifecycleError(`${label} shift must be a positive whole number`)
  }

  return { headerId, entryDate, shift }
}

export function sameCalendarDate(left, right) {
  if (!(left instanceof Date) || Number.isNaN(left.getTime())) return false
  if (!(right instanceof Date) || Number.isNaN(right.getTime())) return false
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10)
}

export async function resolveEntryMachineContext({
  headerModel,
  context,
  label = 'Production entry'
}) {
  if (!headerModel?.findUnique) {
    throw lifecycleError(`${label} header model is unavailable`)
  }

  const normalized = normalizeEntryMachineContext(context, label)
  const header = await headerModel.findUnique({
    where: { id: normalized.headerId },
    select: {
      id: true,
      entry_date: true,
      shift: true,
      total_time: true,
      is_locked: true
    }
  })

  if (!header) throw lifecycleError(`${label} header was not found`, 'ENTRY_HEADER_NOT_FOUND')
  if (!sameCalendarDate(header.entry_date, normalized.entryDate) || Number(header.shift) !== normalized.shift) {
    throw lifecycleError(`${label} date or shift changed; refresh the entry and try again`, 'STALE_ENTRY_CONTEXT')
  }
  if (header.is_locked) {
    throw lifecycleError(`${label} is locked and cannot change machines`, 'ENTRY_LOCKED')
  }

  return {
    ...normalized,
    entryDate: header.entry_date,
    totalTime: Number(header.total_time),
    header
  }
}

export function normalizeMachineNumber(value) {
  const machineNo = String(value ?? '').trim().toUpperCase()
  if (!machineNo) throw lifecycleError('Machine number is required')
  if (machineNo.length > 100) throw lifecycleError('Machine number cannot exceed 100 characters')
  return machineNo
}

export function assertLifecycleCanStart(existingRows, activationDate, machineNo) {
  const rows = Array.isArray(existingRows) ? existingRows : []
  const activation = parseStrictDate(activationDate, 'Activation date')

  for (const row of rows) {
    if (row?.is_active === true) {
      throw lifecycleError(`Machine ${machineNo} already exists and is active`, 'ACTIVE_MACHINE_EXISTS')
    }

    const deactivatedAt = row?.deactivated_at ? parseStrictDate(row.deactivated_at, 'Deactivation date') : null
    if (deactivatedAt && deactivatedAt > activation) {
      throw lifecycleError(
        `Machine ${machineNo} already belongs to another lifecycle on the selected date`,
        'OVERLAPPING_MACHINE_LIFECYCLE'
      )
    }
  }

  return true
}

export function validateInstalledDateForActivation(installedDate, activationDate) {
  if (installedDate === null || installedDate === undefined || installedDate === '') return null
  const installed = parseStrictDate(installedDate, 'Installed date')
  const activation = parseStrictDate(activationDate, 'Activation date')
  if (installed > activation) {
    throw lifecycleError('Installed date cannot be after the selected entry date')
  }
  return installed
}

function normalizeMachineIds(machineIds) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    throw lifecycleError('Select at least one machine to remove')
  }
  const ids = [...new Set(machineIds.map(id => String(id ?? '').trim()).filter(Boolean))]
  if (ids.length !== machineIds.length) throw lifecycleError('Machine selection contains an invalid or duplicate id')
  return ids
}

export async function deactivateEntryMachines({
  headerModel,
  machineModel,
  machineIds,
  context,
  label
}) {
  const resolved = await resolveEntryMachineContext({ headerModel, context, label })
  const ids = normalizeMachineIds(machineIds)
  const machines = await machineModel.findMany({
    where: { id: { in: ids } },
    select: { id: true, is_active: true, activated_at: true, deactivated_at: true }
  })
  if (machines.length !== ids.length) throw lifecycleError('One or more selected machines no longer exist')

  for (const machine of machines) {
    if (machine.activated_at && new Date(machine.activated_at) > resolved.entryDate) {
      throw lifecycleError('A machine cannot be removed before its activation date')
    }
    if (!machine.is_active && machine.deactivated_at && !sameCalendarDate(machine.deactivated_at, resolved.entryDate)) {
      throw lifecycleError('A selected machine was already removed on a different date; refresh the entry')
    }
  }

  const activeIds = machines.filter(machine => machine.is_active).map(machine => machine.id)
  if (activeIds.length) {
    const result = await machineModel.updateMany({
      where: { id: { in: activeIds }, is_active: true },
      data: {
        is_active: false,
        deactivated_at: resolved.entryDate,
        updated_at: new Date()
      }
    })
    if (result.count !== activeIds.length) {
      throw lifecycleError('Machine state changed while removing; refresh and try again', 'STALE_MACHINE_STATE')
    }
  }

  return {
    count: activeIds.length,
    machineIds: ids,
    entryDate: resolved.entryDate,
    shift: resolved.shift,
    headerId: resolved.headerId
  }
}
