const HEADER_FIELDS = new Set(['supervisor_id', 'maisitry_id', 'total_time', 'remarks'])
const STOPPAGE_FIELDS = new Set([
  'stoppage1_id', 'stoppage1_time',
  'stoppage2_id', 'stoppage2_time',
  'stoppage3_id', 'stoppage3_time',
  'stoppage4_id', 'stoppage4_time',
  'run_time', 'is_full_stoppage'
])

const SETUP_FIELDS = new Set([
  'count_name', 'count_id', 'act_count', 'tpi', 'allocated_spindles',
  'tw_con', 'doff_loss', 'c_waste_percent', 'conv_40s_value', 'speed',
  'session_no', 'run_time', 'efficiency', 'conversion_factor', 'target_effi',
  'hank_constant', 'std_efficiency_factor', 'default_waste', 'std_prodn',
  'shift_time', 'default_stoppage', 'divisor_constant', 'delivery',
  'prodn_mixing', 'cc_time', 'sl_hank', 'mc_effi', 'constant',
  'description', 'make_name', 'machine_type', 'spindles'
])

function pickAllowed(values, fields) {
  return Object.fromEntries(
    Object.entries(values || {}).filter(([field]) => fields.has(field))
  )
}

function assertNonNegativeNumbers(values, fields) {
  for (const field of fields) {
    const value = values[field]
    if (value === null || value === undefined || value === '') continue
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid ${field.replaceAll('_', ' ')} value`)
    }
  }
}

export function sanitizeEntryHeaderUpdate(values) {
  const clean = pickAllowed(values, HEADER_FIELDS)
  assertNonNegativeNumbers(clean, ['total_time'])
  return clean
}

export function sanitizeEntryStoppageUpdate(values) {
  const clean = pickAllowed(values, STOPPAGE_FIELDS)
  assertNonNegativeNumbers(clean, [
    'stoppage1_time', 'stoppage2_time', 'stoppage3_time',
    'stoppage4_time', 'run_time'
  ])
  return clean
}

export function sanitizeEntrySetupUpdate(values) {
  const clean = pickAllowed(values, SETUP_FIELDS)
  assertNonNegativeNumbers(clean, [
    'act_count', 'tpi', 'allocated_spindles', 'tw_con', 'doff_loss',
    'c_waste_percent', 'conv_40s_value', 'speed', 'session_no', 'run_time',
    'efficiency', 'conversion_factor', 'target_effi', 'hank_constant',
    'std_efficiency_factor', 'default_waste', 'std_prodn', 'shift_time',
    'default_stoppage', 'divisor_constant', 'delivery', 'cc_time', 'sl_hank',
    'mc_effi', 'constant', 'spindles'
  ])
  return clean
}
