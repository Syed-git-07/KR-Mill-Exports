import { parseStrictDate } from '../strictDate.js'

function invalidMaster(message) {
  const error = new Error(message)
  error.code = 'INVALID_MACHINE_MASTER'
  return error
}

function normalizeBoolean(value, label) {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  throw invalidMaster(`${label} must be true or false`)
}

export function normalizeMachineMasterData(machineData, numericRules = {}) {
  if (!machineData || typeof machineData !== 'object' || Array.isArray(machineData)) {
    throw invalidMaster('Machine data must be an object')
  }

  const machineNo = String(machineData.machine_no ?? '').trim()
  if (!machineNo) throw invalidMaster('Machine number is required')
  if (machineNo.length > 100) throw invalidMaster('Machine number cannot exceed 100 characters')

  const normalized = { ...machineData, machine_no: machineNo }
  if (machineData.installed_date !== null && machineData.installed_date !== undefined && machineData.installed_date !== '') {
    normalized.installed_date = parseStrictDate(machineData.installed_date, 'Installed date')
  } else {
    normalized.installed_date = null
  }

  if (machineData.is_active !== undefined && machineData.is_active !== null) {
    normalized.is_active = normalizeBoolean(machineData.is_active, 'Active status')
  }

  for (const [field, rule] of Object.entries(numericRules)) {
    const value = machineData[field]
    if (value === null || value === undefined || value === '') {
      if (rule.required) throw invalidMaster(`${rule.label} is required`)
      continue
    }
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || (rule.integer && !Number.isInteger(parsed))) {
      throw invalidMaster(`${rule.label} must be a valid${rule.integer ? ' whole' : ''} number`)
    }
    if (parsed <= (rule.min ?? 0) || parsed > (rule.max ?? Number.MAX_SAFE_INTEGER)) {
      throw invalidMaster(`${rule.label} must be greater than ${rule.min ?? 0} and at most ${rule.max ?? Number.MAX_SAFE_INTEGER}`)
    }
    normalized[field] = parsed
  }

  return normalized
}

export function buildMachineLifecycleUpdate(currentActive, requestedActive, now = new Date()) {
  if (requestedActive === undefined || requestedActive === null) return {}
  const nextActive = normalizeBoolean(requestedActive, 'Active status')
  if (nextActive === Boolean(currentActive)) return { is_active: nextActive }
  return nextActive
    ? { is_active: true, activated_at: now, deactivated_at: null }
    : { is_active: false, deactivated_at: now }
}
