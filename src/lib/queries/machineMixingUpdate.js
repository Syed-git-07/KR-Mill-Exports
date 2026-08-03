function invalidMachineMixingUpdate(message) {
  const error = new Error(message)
  error.code = 'INVALID_MACHINE_MIXING_UPDATE'
  return error
}

export function normalizeMachineIds(machineIds) {
  const source = Array.isArray(machineIds) ? machineIds : [machineIds]
  if (source.length === 0) {
    throw invalidMachineMixingUpdate('Select at least one machine')
  }

  const normalized = source.map(machineId => (
    typeof machineId === 'string' ? machineId.trim() : ''
  ))

  if (normalized.some(machineId => !machineId)) {
    throw invalidMachineMixingUpdate('Every selected machine must have a valid id')
  }

  return [...new Set(normalized)]
}

export function normalizeMixingValue(value, maxLength = 100) {
  const normalized = typeof value === 'string'
    ? value.trim()
    : (typeof value === 'number' && Number.isFinite(value) ? String(value) : '')

  if (!normalized) {
    throw invalidMachineMixingUpdate('Mixing/count is required')
  }
  if (normalized.length > maxLength) {
    throw invalidMachineMixingUpdate(`Mixing/count cannot exceed ${maxLength} characters`)
  }

  return normalized
}

export function assertMachineUpdateCount(actualCount, expectedCount, targetLabel) {
  if (actualCount !== expectedCount) {
    throw invalidMachineMixingUpdate(
      `Expected ${expectedCount} ${targetLabel} row(s), but found ${actualCount}`
    )
  }
}

export async function resolveMachineMixingContext({
  headerModel,
  machineModel,
  headerId,
  machineIds
}) {
  const normalizedMachineIds = normalizeMachineIds(machineIds)
  if (headerId !== null && headerId !== undefined && typeof headerId !== 'string') {
    throw invalidMachineMixingUpdate('Production header id must be a string')
  }
  const normalizedHeaderId = typeof headerId === 'string' ? headerId.trim() : ''

  const header = normalizedHeaderId
    ? await headerModel.findUnique({
        where: { id: normalizedHeaderId },
        select: { id: true, entry_date: true, shift: true }
      })
    : null

  if (normalizedHeaderId && !header) {
    throw invalidMachineMixingUpdate('The production header no longer exists')
  }

  const machines = await machineModel.findMany({
    where: {
      id: { in: normalizedMachineIds },
      is_active: true
    },
    select: { id: true }
  })
  const existingMachineIds = new Set(machines.map(machine => machine.id))
  const missingMachineIds = normalizedMachineIds.filter(machineId => !existingMachineIds.has(machineId))
  if (missingMachineIds.length > 0) {
    throw invalidMachineMixingUpdate('One or more selected machines are missing or inactive')
  }

  return {
    header,
    machineIds: normalizedMachineIds
  }
}
