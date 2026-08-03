function invalidSetup(message) {
  const error = new Error(message)
  error.code = 'INVALID_MACHINE_SETUP'
  return error
}

function assertUpdateObject(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw invalidSetup('Machine setup updates must be an object')
  }
}

function finiteNumber(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false, allowZero = false } = {}) {
  if (value === null || value === undefined || value === '') {
    throw invalidSetup(`${label} is required`)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    throw invalidSetup(`${label} must be a valid${integer ? ' whole' : ''} number`)
  }
  const lowerBoundValid = allowZero ? parsed >= min : parsed > min
  if (!lowerBoundValid || parsed > max) {
    const comparison = allowZero ? `between ${min} and ${max}` : `greater than ${min} and at most ${max}`
    throw invalidSetup(`${label} must be ${comparison}`)
  }
  return parsed
}

function textValue(value, label, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) throw invalidSetup(`${label} is required`)
  if (normalized.length > maxLength) throw invalidSetup(`${label} cannot exceed ${maxLength} characters`)
  return normalized
}

export function sanitizeAutoconerSetupUpdate(updates) {
  assertUpdateObject(updates)
  const output = {}

  if (Object.prototype.hasOwnProperty.call(updates, 'count_name')) {
    output.count_name = textValue(updates.count_name, 'Count name', 100)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'count_id')) {
    output.count_id = textValue(updates.count_id, 'Count id', 36)
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'act_count')) {
    output.act_count = finiteNumber(updates.act_count, 'Actual count', { max: 1000 })
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'session_no')) {
    output.session_no = finiteNumber(updates.session_no, 'Session number', { max: 99, integer: true })
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'run_time')) {
    output.run_time = finiteNumber(updates.run_time, 'Run time', { max: 1440, integer: true })
  }

  return output
}

export function validateCompleteAutoconerSetup(setup) {
  assertUpdateObject(setup)
  const requiredFields = ['count_name', 'count_id', 'act_count', 'session_no', 'run_time']
  const missing = requiredFields.filter(field => (
    setup[field] === null || setup[field] === undefined || setup[field] === ''
  ))
  if (missing.length > 0) {
    throw invalidSetup(`Autoconer setup is incomplete: ${missing.join(', ')}`)
  }
  return sanitizeAutoconerSetupUpdate(setup)
}

export function sanitizeSpinningSetupUpdate(updates) {
  assertUpdateObject(updates)
  const output = {}

  if (Object.prototype.hasOwnProperty.call(updates, 'count_name')) {
    output.count_name = textValue(updates.count_name, 'Count name', 100)
  }

  const positiveFields = {
    act_count: ['Actual count', 1000, false],
    tpi: ['TPI', 1000, false],
    allocated_spindles: ['Allocated spindles', 100000, true],
    tw_con: ['Twist contraction', 1000, true],
    speed: ['Speed', 1000000, true],
    session_no: ['Session number', 99, true],
    run_time: ['Run time', 1440, true],
    conversion_factor: ['Conversion factor', 100, false]
  }
  for (const [field, [label, max, integer]] of Object.entries(positiveFields)) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      output[field] = finiteNumber(updates[field], label, { max, integer })
    }
  }

  for (const [field, label] of [['doff_loss', 'Doff loss'], ['c_waste_percent', 'Count waste percentage']]) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      output[field] = finiteNumber(updates[field], label, { min: 0, max: 100, allowZero: true })
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'efficiency')) {
    output.efficiency = finiteNumber(updates.efficiency, 'Efficiency factor', { max: 1 })
  }

  return output
}

export function validateCompleteSpinningSetup(setup) {
  assertUpdateObject(setup)
  const requiredFields = [
    'count_name',
    'act_count',
    'tpi',
    'allocated_spindles',
    'tw_con',
    'speed',
    'session_no',
    'run_time',
    'efficiency',
    'conversion_factor'
  ]
  const missing = requiredFields.filter(field => (
    setup[field] === null || setup[field] === undefined || setup[field] === ''
  ))
  if (missing.length > 0) {
    throw invalidSetup(`Spinning setup is incomplete: ${missing.join(', ')}`)
  }
  return sanitizeSpinningSetupUpdate(setup)
}
