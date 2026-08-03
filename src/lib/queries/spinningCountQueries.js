import { prisma } from '../prisma'
import { deleteUnusedSpinningCount } from './masterDeletion'

const COUNT_FIELDS = new Set([
  'count_name', 'short_desc', 'act_count', 'mixing_name', 'fibre',
  'conv_40s_value', 'ukg', 'effi_exp_hank', 'effi_exp_prodn',
  'is_running_now', 'autoconer_active', 'sitra_conv_value', 'cone_weight',
  'effi_actual_prodn', 'tpi', 'speed', 'speed_autoconer', 'tw_con',
  'waste_percent', 'doff_loss', 'auto_effi', 'hok_cons', 'sliver_hank',
  'is_active'
])

const STRING_FIELDS = new Set([
  'count_name', 'short_desc', 'mixing_name', 'fibre', 'tpi', 'speed', 'tw_con'
])
const NUMERIC_STRING_FIELDS = new Set(['tpi', 'speed', 'tw_con'])

const BOOLEAN_FIELDS = new Set(['is_running_now', 'autoconer_active', 'is_active'])

function cleanCountData(countData = {}, { creating = false } = {}) {
  const cleanData = {}
  for (const [key, value] of Object.entries(countData)) {
    if (!COUNT_FIELDS.has(key) || value === undefined) continue

    if (BOOLEAN_FIELDS.has(key)) {
      if (typeof value !== 'boolean') throw new Error(`${key} must be true or false`)
      cleanData[key] = value
    } else if (STRING_FIELDS.has(key)) {
      cleanData[key] = value == null || value === '' ? null : String(value).trim()
      if (cleanData[key] != null && NUMERIC_STRING_FIELDS.has(key)) {
        const number = Number(cleanData[key])
        if (!Number.isFinite(number) || number < 0) throw new Error(`${key} must be a non-negative number`)
      }
    } else {
      if (value == null || value === '') {
        cleanData[key] = null
      } else {
        const number = Number(value)
        if (!Number.isFinite(number) || number < 0) throw new Error(`${key} must be a non-negative number`)
        cleanData[key] = number
      }
    }
  }

  if (creating || Object.prototype.hasOwnProperty.call(cleanData, 'count_name')) {
    if (!cleanData.count_name) throw new Error('Count Name is required')
  }
  if (creating || Object.prototype.hasOwnProperty.call(cleanData, 'act_count')) {
    if (cleanData.act_count == null) throw new Error('Act Count is required')
  }
  if (creating && cleanData.is_active === undefined) cleanData.is_active = true
  return cleanData
}

async function assertUniqueCountName(transaction, countName, excludeId = null) {
  const duplicate = await transaction.spinning_counts.findFirst({
    where: {
      count_name: { equals: countName },
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  })
  if (duplicate) throw new Error(`Spinning count "${countName}" already exists`)
}

/**
 * Spinning Count Master CRUD Operations
 */

// Get all spinning counts
export async function getSpinningCounts() {
  const data = await prisma.spinning_counts.findMany({
    orderBy: { count_name: 'asc' }
  })

  return (data || []).sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return a.count_name.localeCompare(b.count_name)
  })
}

// Create new spinning count
export async function createSpinningCount(countData) {
  const cleanData = cleanCountData(countData, { creating: true })
  return prisma.$transaction(async transaction => {
    await assertUniqueCountName(transaction, cleanData.count_name)
    return transaction.spinning_counts.create({ data: cleanData })
  })
}

// Update spinning count
export async function updateSpinningCount(id, countData) {
  if (!id) throw new Error('No ID provided for update')
  const cleanData = cleanCountData(countData)

  return prisma.$transaction(async transaction => {
    const existingRecord = await transaction.spinning_counts.findUnique({ where: { id } })
    if (!existingRecord) throw new Error(`Record with ID ${id} not found`)

    const nextName = cleanData.count_name ?? existingRecord.count_name
    if (cleanData.count_name) await assertUniqueCountName(transaction, cleanData.count_name, id)

    const data = await transaction.spinning_counts.update({
      where: { id },
      data: cleanData
    })

    // Several production tables predate foreign keys and store a display-name
    // snapshot. Keep the name synchronized so a count rename is visible in all
    // associated masters and entry screens without rewriting historical output.
    if (nextName !== existingRecord.count_name) {
      await Promise.all([
        transaction.spinning_machine_setup.updateMany({
          where: { count_name: existingRecord.count_name },
          data: { count_name: nextName }
        }),
        transaction.spinning_production_detail.updateMany({
          where: { count_name: existingRecord.count_name },
          data: { count_name: nextName }
        }),
        transaction.autoconer_machine_setup.updateMany({
          where: {
            OR: [
              { count_id: id },
              { count_id: null, count_name: existingRecord.count_name }
            ]
          },
          data: { count_id: id, count_name: nextName }
        }),
        transaction.autoconer_production_detail.updateMany({
          where: {
            OR: [
              { count_id: id },
              { count_id: null, count_name: existingRecord.count_name }
            ]
          },
          data: { count_id: id, count_name: nextName }
        }),
        transaction.autoconer_machines.updateMany({
          where: { count: existingRecord.count_name },
          data: { count: nextName }
        })
      ])
    }

    // Setup rows are working configuration, so current master formula inputs
    // should follow explicit count changes. Historical production results stay
    // untouched; only their count label is synchronized above.
    const spinningSetupData = {}
    if (Object.prototype.hasOwnProperty.call(cleanData, 'act_count')) spinningSetupData.act_count = cleanData.act_count
    if (Object.prototype.hasOwnProperty.call(cleanData, 'tpi')) spinningSetupData.tpi = cleanData.tpi == null ? null : Number(cleanData.tpi)
    if (Object.prototype.hasOwnProperty.call(cleanData, 'speed')) spinningSetupData.speed = cleanData.speed == null ? null : Math.trunc(Number(cleanData.speed))
    if (Object.prototype.hasOwnProperty.call(cleanData, 'tw_con')) spinningSetupData.tw_con = cleanData.tw_con == null ? null : Math.trunc(Number(cleanData.tw_con))
    if (Object.prototype.hasOwnProperty.call(cleanData, 'doff_loss')) spinningSetupData.doff_loss = cleanData.doff_loss
    if (Object.keys(spinningSetupData).length) {
      await transaction.spinning_machine_setup.updateMany({
        where: { count_name: nextName },
        data: spinningSetupData
      })
    }
    if (Object.prototype.hasOwnProperty.call(cleanData, 'act_count')) {
      await transaction.autoconer_machine_setup.updateMany({
        where: { OR: [{ count_id: id }, { count_name: nextName }] },
        data: { count_id: id, act_count: cleanData.act_count }
      })
    }

    return data
  })
}

// Delete spinning count
export async function deleteSpinningCount(id) {
  return deleteUnusedSpinningCount(id)
}

// Search spinning counts
export async function searchSpinningCounts(field, condition, value) {
  const allowedFields = new Set(['count_name', 'act_count', 'is_active'])
  if (!allowedFields.has(field)) throw new Error('Unsupported spinning count search field')
  const numericFields = ['act_count']
  let whereClause = {}

  if (value && value.trim() !== '') {
    switch (condition) {
      case 'Like':
        // MySQL doesn't support mode: 'insensitive', string comparisons are case-insensitive by default
        if (field === 'count_name') whereClause[field] = { contains: value.trim() }
        else if (field === 'is_active') whereClause[field] = value.trim().toLowerCase() === 'true'
        else whereClause[field] = parseFloat(value)
        break;
      case 'Equal':
        if (numericFields.includes(field)) {
          whereClause[field] = parseFloat(value);
        } else {
          whereClause[field] = field === 'is_active'
            ? value.trim().toLowerCase() === 'true'
            : value.trim();
        }
        break;
      case 'Not Equal':
        if (numericFields.includes(field)) {
          whereClause[field] = { not: parseFloat(value) };
        } else {
          whereClause[field] = { not: field === 'is_active'
            ? value.trim().toLowerCase() === 'true'
            : value.trim() };
        }
        break;
      case 'Greater':
        if (numericFields.includes(field)) {
          whereClause[field] = { gt: parseFloat(value) };
        }
        break;
      case 'Less':
        if (numericFields.includes(field)) {
          whereClause[field] = { lt: parseFloat(value) };
        }
        break;
    }
  }

  const data = await prisma.spinning_counts.findMany({
    where: whereClause,
    orderBy: { count_name: 'asc' }
  });

  return (data || []).sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return a.count_name.localeCompare(b.count_name)
  })
}
