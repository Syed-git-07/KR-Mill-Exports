function invalidSetup(message) {
  const error = new Error(message)
  error.code = 'INVALID_MACHINE_SETUP'
  return error
}

function validateUpdateObject(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw invalidSetup('Machine setup updates must be an object')
  }
}

function finiteNumber(value, label, {
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  integer = false,
  allowZero = false
} = {}) {
  if (value === null || value === undefined || value === '') {
    throw invalidSetup(`${label} is required`)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    throw invalidSetup(`${label} must be a valid${integer ? ' whole' : ''} number`)
  }
  if ((allowZero ? parsed < min : parsed <= min) || parsed > max) {
    throw invalidSetup(
      allowZero
        ? `${label} must be between ${min} and ${max}`
        : `${label} must be greater than ${min} and at most ${max}`
    )
  }
  return parsed
}

function textValue(value, label, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) throw invalidSetup(`${label} is required`)
  if (normalized.length > maxLength) {
    throw invalidSetup(`${label} cannot exceed ${maxLength} characters`)
  }
  return normalized
}

const DRAWING_NUMERIC_RULES = Object.freeze({
  speed: ['Speed', { max: 1000000, integer: true }],
  std_efficiency_factor: ['Standard efficiency factor', { max: 1 }],
  hank_constant: ['Hank constant', { max: 100 }],
  delivery: ['Delivery', { max: 1000, integer: true }],
  shift_time: ['Shift time', { max: 1440, integer: true }],
  divisor_constant: ['Divisor constant', { max: 1000000000 }],
  default_waste: ['Default waste', { min: 0, max: 100, allowZero: true }],
  default_stoppage: ['Default stoppage', { min: 0, max: 1440, integer: true, allowZero: true }]
})

function sanitizeWithRules(updates, { numeric = {}, text = {} }) {
  validateUpdateObject(updates)
  const sanitized = {}

  for (const [field, [label, options]] of Object.entries(numeric)) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      sanitized[field] = finiteNumber(updates[field], label, options)
    }
  }
  for (const [field, [label, maxLength]] of Object.entries(text)) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      sanitized[field] = textValue(updates[field], label, maxLength)
    }
  }

  return sanitized
}

export function sanitizeBreakerDrawingSetupUpdate(updates) {
  return sanitizeWithRules(updates, { numeric: DRAWING_NUMERIC_RULES })
}

export function sanitizeFinisherDrawingSetupUpdate(updates) {
  return sanitizeWithRules(updates, { numeric: DRAWING_NUMERIC_RULES })
}

export function sanitizeLapFormerSetupUpdate(updates) {
  return sanitizeWithRules(updates, { numeric: DRAWING_NUMERIC_RULES })
}

export function sanitizeComberSetupUpdate(updates) {
  return sanitizeWithRules(updates, {
    numeric: {
      session_no: ['Session number', { max: 99, integer: true }],
      cc_time: ['Change-over time', { min: 0, max: 1440, integer: true, allowZero: true }],
      sl_hank: ['Sliver hank', { max: 100 }],
      mc_effi: ['Machine efficiency', { max: 100 }],
      shift_time: ['Shift time', { max: 1440, integer: true }],
      default_waste: ['Default waste', { min: 0, max: 100, allowZero: true }]
    },
    text: {
      prodn_mixing: ['Production mixing', 100]
    }
  })
}

export function sanitizeSimplexSetupUpdate(updates) {
  return sanitizeWithRules(updates, {
    numeric: {
      session_no: ['Session number', { max: 99, integer: true }],
      cc_time: ['Change-over time', { min: 0, max: 1440, integer: true, allowZero: true }],
      sl_hank: ['Sliver hank', { max: 100 }],
      mc_effi: ['Machine efficiency', { max: 100 }],
      tpi: ['TPI', { max: 1000 }],
      spindles: ['Spindles', { max: 100000, integer: true }],
      shift_time: ['Shift time', { max: 1440, integer: true }],
      default_waste: ['Default waste', { min: 0, max: 100, allowZero: true }]
    },
    text: {
      prodn_mixing: ['Production mixing', 50]
    }
  })
}
