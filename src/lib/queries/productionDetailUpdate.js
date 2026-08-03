const UPDATE_FIELDS_BY_MODEL = Object.freeze({
  autoconer_production_detail: new Set([
    'emp_name',
    'count_name',
    'count_id',
    'act_prodn',
    'prodn_effi',
    'red_light',
    'idle_drum',
    'idle_reason',
    'waste_kg',
    'waste_percent',
    'total_stoppage_mins',
    'work_time',
    'run_time',
    'session_no',
    'is_verified'
  ]),
  breaker_drawing_production_detail: new Set([
    'employee_name',
    'prodn_mixing',
    'act_hank',
    'act_prodn',
    'std_prodn',
    'exp_prodn',
    'effi_percent',
    'uti_percent',
    'waste',
    'waste_percent',
    'run_time',
    'work_time',
    'session_no',
    'is_verified',
    'verified_at',
    'total_stoppage_mins'
  ]),
  carding_production_detail: new Set([
    'employee_name',
    'count_mixing',
    'act_hank',
    'act_prodn',
    'std_prodn',
    'exp_prodn',
    'effi_percent',
    'uti_percent',
    'waste',
    'waste_percent',
    'run_time',
    'work_time',
    'session_no',
    'is_verified',
    'verified_at',
    'total_stoppage_mins'
  ]),
  comber_production_detail: new Set([
    'employee_name',
    'prodn_mixing',
    'act_hank',
    'run_hrs',
    'run_min',
    'waste',
    'act_prodn',
    'waste_percent',
    'act_effi_percent',
    'uti_percent',
    'std_hrs',
    'work_time',
    'session_no',
    'is_verified',
    'verified_at',
    'is_locked',
    'total_stoppage_mins'
  ]),
  finisher_drawing_production_detail: new Set([
    'employee_name',
    'prodn_mixing',
    'act_hank',
    'act_prodn',
    'std_prodn',
    'exp_prodn',
    'effi_percent',
    'uti_percent',
    'waste',
    'waste_percent',
    'run_time',
    'work_time',
    'session_no',
    'is_locked',
    'remarks',
    'total_stoppage_mins'
  ]),
  lap_former_production_detail: new Set([
    'employee_name',
    'prodn_mixing',
    'act_hank',
    'act_prodn',
    'std_prodn',
    'exp_prodn',
    'effi_percent',
    'uti_percent',
    'waste',
    'waste_percent',
    'run_time',
    'work_time',
    'session_no',
    'is_verified',
    'verified_at',
    'total_stoppage_mins'
  ]),
  simplex_production_detail: new Set([
    'employee_name',
    'prodn_mixing',
    'run_hrs',
    'run_min',
    'idle_spindles',
    'waste',
    'act_prodn',
    'waste_percent',
    'act_effi_percent',
    'uti_percent',
    'std_hrs',
    'work_time',
    'run_time',
    'session_no',
    'is_locked',
    'remarks'
  ]),
  spinning_production_detail: new Set([
    'count_name',
    'act_hank',
    'act_prodn',
    'waste',
    'waste_percent',
    'gps',
    'worked_spindles',
    'stopped_spindles',
    'exp_gps',
    'total_stoppage_mins',
    'session_no',
    'is_verified',
    'verified_at',
    'is_locked',
    'remarks',
    'sider1_name',
    'sider2_name',
    'work_time',
    'run_time'
  ])
})

const COMMON_HEADER_UPDATE_FIELDS = new Set([
  'supervisor_id',
  'maisitry_id',
  'total_time',
  'remarks',
  'is_locked'
])

const HEADER_UPDATE_FIELDS_BY_MODEL = Object.freeze({
  autoconer_production_header: new Set([
    'supervisor_id',
    'total_time',
    'remarks',
    'is_locked'
  ]),
  breaker_drawing_production_header: COMMON_HEADER_UPDATE_FIELDS,
  carding_production_header: COMMON_HEADER_UPDATE_FIELDS,
  comber_production_header: COMMON_HEADER_UPDATE_FIELDS,
  finisher_drawing_production_header: COMMON_HEADER_UPDATE_FIELDS,
  lap_former_production_header: COMMON_HEADER_UPDATE_FIELDS,
  simplex_production_header: COMMON_HEADER_UPDATE_FIELDS,
  spinning_production_header: COMMON_HEADER_UPDATE_FIELDS
})

function sanitizeUpdate(allowedFields, model, updates) {
  if (!allowedFields) {
    throw new TypeError(`Unknown production model: ${model}`)
  }

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new TypeError('Production updates must be an object')
  }

  return Object.fromEntries(
    Object.entries(updates).filter(([field, value]) => (
      allowedFields.has(field) && value !== undefined
    ))
  )
}

/**
 * Keeps client-originated production updates inside the selected Prisma model.
 *
 * Entry grids also carry display/setup values such as `speed`, `machine`, and
 * stoppage relations. Passing those objects directly to Prisma causes runtime
 * "Unknown argument" failures and could allow ownership fields to be changed.
 */
export function sanitizeProductionDetailUpdate(model, updates = {}) {
  return sanitizeUpdate(UPDATE_FIELDS_BY_MODEL[model], model, updates)
}

/** Prevents entry-page header actions from changing identity/date/shift fields. */
export function sanitizeProductionHeaderUpdate(model, updates = {}) {
  return sanitizeUpdate(HEADER_UPDATE_FIELDS_BY_MODEL[model], model, updates)
}
