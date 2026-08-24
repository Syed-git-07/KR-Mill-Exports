import { z } from 'zod'

const emptyToNull = value => (
  value === '' || value === undefined ? null : value
)

const trimmedString = (minimum = 1, maximum = 255) => z.string()
  .trim()
  .min(minimum, `Must be at least ${minimum} character${minimum === 1 ? '' : 's'}`)
  .max(maximum, `Must be ${maximum} characters or less`)

const nullableString = maximum => z.preprocess(
  emptyToNull,
  z.union([z.string().trim().max(maximum), z.null()])
    .transform(value => value === '' ? null : value)
)

const nullableNumber = (maximum = Number.MAX_SAFE_INTEGER) => z.preprocess(
  emptyToNull,
  z.union([
    z.coerce.number().finite().nonnegative('Value cannot be negative').max(maximum),
    z.null()
  ])
)

const nullableInteger = (maximum = 2147483647) => z.preprocess(
  emptyToNull,
  z.union([
    z.coerce.number().int('A whole number is required').nonnegative('Value cannot be negative').max(maximum),
    z.null()
  ])
)

const nullablePositiveInteger = (maximum = 2147483647) => z.preprocess(
  emptyToNull,
  z.union([
    z.coerce.number().int('A whole number is required').positive('A valid selection is required').max(maximum),
    z.null()
  ])
)

const nullableUuid = z.preprocess(
  emptyToNull,
  z.union([z.string().uuid('A valid selection is required'), z.null()])
)

const dateStringSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'A valid date in YYYY-MM-DD format is required')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'A valid date in YYYY-MM-DD format is required')
  .transform(value => new Date(`${value}T00:00:00.000Z`))

const dateOnlySchema = z.union([
  z.date({ error: 'A valid date is required' }),
  dateStringSchema
])

const nullableDateOnlySchema = z.preprocess(
  emptyToNull,
  z.union([dateOnlySchema, z.null()])
)

export const masterUuidSchema = z.string().uuid('A valid record ID is required')

export const departmentCreateSchema = z.object({
  code: z.coerce.number().int().nonnegative('Code cannot be negative'),
  dept_name: trimmedString(2, 255),
  sl_no: z.coerce.number().int().nonnegative('Serial number cannot be negative'),
  hok: z.coerce.number().finite().nonnegative('H.O.K cannot be negative'),
  is_active: z.boolean().optional()
}).strict()
export const departmentUpdateSchema = departmentCreateSchema.partial()

export const supervisorCreateSchema = z.object({
  payroll_employee_id: z.coerce.number().int('A payroll employee must be selected').positive('A payroll employee must be selected'),
  department_id: nullableUuid,
  code: nullableInteger().optional(),
  is_active: z.boolean().optional()
}).strict()
export const supervisorUpdateSchema = z.object({
  payroll_employee_id: nullablePositiveInteger().optional(),
  department_id: nullableUuid.optional(),
  code: nullableInteger().optional(),
  is_active: z.boolean().optional()
}).strict().refine(data => Object.keys(data).length > 0, 'At least one field is required')

export const stoppageHeadCreateSchema = z.object({
  code: nullableInteger().optional(),
  stoppage_head_name: trimmedString(1, 255),
  description: nullableString(5000).optional(),
  is_active: z.boolean().optional()
}).strict()
export const stoppageHeadUpdateSchema = stoppageHeadCreateSchema.partial()

export const stoppageDetailCreateSchema = z.object({
  code: nullableInteger().optional(),
  stoppage_name: trimmedString(1, 255),
  description: nullableString(5000).optional(),
  short_code: nullableString(10).optional(),
  department_id: z.string().uuid('A valid department is required'),
  stoppage_head_id: z.string().uuid('A valid stoppage head is required'),
  full_stoppage_name: nullableString(5000).optional(),
  is_active: z.boolean().optional()
}).strict()
export const stoppageDetailUpdateSchema = stoppageDetailCreateSchema.partial()

const spinningCountShape = {
  count_name: trimmedString(1, 100),
  short_desc: nullableString(50).optional(),
  act_count: z.coerce.number().finite().nonnegative('Actual count cannot be negative'),
  mixing_name: nullableString(100).optional(),
  fibre: nullableString(50).optional(),
  conv_40s_value: nullableNumber().optional(),
  ukg: nullableNumber().optional(),
  effi_exp_hank: nullableNumber(100).optional(),
  effi_exp_prodn: nullableNumber(100).optional(),
  is_running_now: z.boolean().optional(),
  autoconer_active: z.boolean().optional(),
  sitra_conv_value: nullableNumber().optional(),
  cone_weight: nullableNumber().optional(),
  effi_actual_prodn: nullableNumber(100).optional(),
  tpi: nullableString(50).optional(),
  speed: nullableString(50).optional(),
  speed_autoconer: nullableNumber().optional(),
  tw_con: nullableString(50).optional(),
  waste_percent: nullableNumber(100).optional(),
  doff_loss: nullableNumber(100).optional(),
  auto_effi: nullableNumber(100).optional(),
  hok_cons: nullableNumber().optional(),
  sliver_hank: nullableNumber().optional(),
  is_active: z.boolean().optional()
}
export const spinningCountCreateSchema = z.object(spinningCountShape).strict()
export const spinningCountUpdateSchema = spinningCountCreateSchema.partial()

const commonMachineShape = {
  mc_id: nullableInteger().optional(),
  machine_no: trimmedString(1, 20),
  description: trimmedString(1, 100),
  make_name: nullableString(255).optional(),
  model: nullableString(255).optional(),
  prodn_mixing: nullableString(100).optional(),
  speed: nullableInteger().optional(),
  installed_date: nullableDateOnlySchema.optional(),
  is_active: z.boolean().optional(),
  direct_hank_entry: z.boolean().optional(),
  direct_kgs_entry: z.boolean().optional()
}

const machineSchema = extension => z.object({ ...commonMachineShape, ...extension }).strict()

const cardingSchema = machineSchema({
  prodn_effi: nullableNumber(100).optional(),
  hank_constant: nullableNumber().optional()
})
export const cardingMachineCreateSchema = cardingSchema
export const cardingMachineUpdateSchema = cardingSchema.partial()

const comberSchema = machineSchema({
  mc_effi: nullableNumber(100).optional(),
  sliver_hank: nullableNumber().optional()
})
export const comberMachineCreateSchema = comberSchema
export const comberMachineUpdateSchema = comberSchema.partial()

const drawingBreakerSchema = machineSchema({
  prodn_effi: nullableNumber(100).optional(),
  delivery: nullableInteger().optional(),
  sliver_hank: nullableNumber().optional()
})
export const drawingBreakerCreateSchema = drawingBreakerSchema
export const drawingBreakerUpdateSchema = drawingBreakerSchema.partial()

const drawingFinisherSchema = machineSchema({
  prodn_effi: nullableNumber(100).optional()
})
export const drawingFinisherCreateSchema = drawingFinisherSchema
export const drawingFinisherUpdateSchema = drawingFinisherSchema.partial()

const lapFormerSchema = machineSchema({
  prodn_effi: nullableNumber(100).optional(),
  delivery: nullableInteger().optional(),
  hank_constant: nullableNumber().optional(),
  std_efficiency_factor: nullableNumber(1).optional(),
  default_waste: nullableNumber().optional(),
  shift_time: nullableInteger().optional(),
  divisor_constant: nullableNumber().optional()
})
export const lapFormerCreateSchema = lapFormerSchema
export const lapFormerUpdateSchema = lapFormerSchema.partial()

const simplexSchema = machineSchema({
  prodn_effi: nullableNumber(100).optional(),
  mc_effi: nullableNumber(100).optional(),
  tpi: nullableNumber().optional(),
  count_tpi: nullableString(50).optional(),
  no_of_spindles: nullableInteger().optional()
})
export const simplexMachineCreateSchema = simplexSchema
export const simplexMachineUpdateSchema = simplexSchema.partial()

const spinningMachineSchema = z.object({
  machine_no: trimmedString(1, 20),
  description: trimmedString(1, 255),
  make_name: trimmedString(1, 255),
  model: nullableString(255).optional(),
  allocated_spindles: z.coerce.number().int().nonnegative('Allocated spindles cannot be negative'),
  installed_date: nullableDateOnlySchema.optional(),
  is_active: z.boolean().optional(),
  production_kgs_manual_entry: z.boolean().optional(),
  direct_hank_entry: z.boolean().optional(),
  speed: nullableInteger().optional(),
  count_id: nullableUuid.optional()
}).strict()
export const spinningMachineCreateSchema = spinningMachineSchema
export const spinningMachineUpdateSchema = spinningMachineSchema.partial()

const autoconerMachineObjectSchema = z.object({
  mc_id: nullableInteger().optional(),
  group_id: nullableInteger().optional(),
  machine_no: trimmedString(1, 50),
  description: trimmedString(1, 255),
  make_name: trimmedString(1, 255),
  model: nullableString(255).optional(),
  from_drum: nullableInteger().optional(),
  to_drum: nullableInteger().optional(),
  no_of_drums: nullableInteger().optional(),
  count: nullableString(100).optional(),
  count_id: nullableUuid.optional(),
  installed_date: nullableDateOnlySchema.optional(),
  is_active: z.boolean().optional(),
  direct_prod_entry: z.boolean().optional()
}).strict()

const validateAutoconerDrumRange = (value, context) => {
  if (value.from_drum != null && value.to_drum != null && value.to_drum < value.from_drum) {
    context.addIssue({ code: 'custom', path: ['to_drum'], message: 'To drum cannot be less than from drum' })
  }
}
export const autoconerMachineCreateSchema = autoconerMachineObjectSchema.superRefine(validateAutoconerDrumRange)
export const autoconerMachineUpdateSchema = autoconerMachineObjectSchema.partial().superRefine(validateAutoconerDrumRange)

const qualityEntryShape = {
  entry_date: dateOnlySchema,
  spinning_count_id: z.string().uuid('A valid spinning count is required'),
  machine_id: nullableUuid.optional(),
  shift: nullableString(50).optional(),
  remarks: nullableString(5000).optional()
}
export const tpiEntryCreateSchema = z.object({
  ...qualityEntryShape,
  tpi_value: z.coerce.number().finite().nonnegative('TPI cannot be negative')
}).strict()
export const tpiEntryUpdateSchema = tpiEntryCreateSchema.partial()
export const twcEntryCreateSchema = z.object({
  ...qualityEntryShape,
  twc_value: z.coerce.number().finite().nonnegative('TWC cannot be negative')
}).strict()
export const twcEntryUpdateSchema = twcEntryCreateSchema.partial()

const hokDetailSchema = z.object({
  department_id: z.string().uuid('A valid department is required'),
  shift1: z.coerce.number().finite().nonnegative('Shift 1 strength cannot be negative'),
  shift2: z.coerce.number().finite().nonnegative('Shift 2 strength cannot be negative'),
  shift3: z.coerce.number().finite().nonnegative('Shift 3 strength cannot be negative')
}).strict()

export const hokIdSchema = z.coerce.number().int().positive('A valid HOK ID is required')

export const hokEntrySchema = z.object({
  date: dateOnlySchema,
  hok_id: hokIdSchema.nullish(),
  entries: z.array(hokDetailSchema).min(1, 'At least one department entry is required')
}).strict().superRefine((value, context) => {
  const seen = new Set()
  value.entries.forEach((entry, index) => {
    if (seen.has(entry.department_id)) {
      context.addIssue({
        code: 'custom',
        path: ['entries', index, 'department_id'],
        message: 'Each department may appear only once'
      })
    }
    seen.add(entry.department_id)
  })
})
