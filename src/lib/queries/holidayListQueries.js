import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

async function findTableSchema(tableName) {
  try {
    const [found] = await prisma.$queryRaw`
      SELECT TABLE_SCHEMA as schema_name
      FROM information_schema.tables
      WHERE table_name = ${tableName}
        AND TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
      ORDER BY (TABLE_SCHEMA = DATABASE()) DESC, TABLE_SCHEMA ASC
      LIMIT 1
    `
    return found?.schema_name || null
  } catch (e) {
    return null
  }
}

async function findTableSchemas(tableName) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT TABLE_SCHEMA as schema_name
      FROM information_schema.tables
      WHERE table_name = ${tableName}
        AND TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
      ORDER BY (TABLE_SCHEMA = DATABASE()) DESC, TABLE_SCHEMA ASC
    `
    return (rows || []).map(r => r.schema_name).filter(Boolean)
  } catch (e) {
    return []
  }
}

let holidayTablesSchemaPromise

async function findHolidayTablesSchema() {
  if (!holidayTablesSchemaPromise) {
    holidayTablesSchemaPromise = prisma.$queryRaw`
      SELECT h.TABLE_SCHEMA AS schema_name
      FROM information_schema.tables h
      INNER JOIN information_schema.tables hl
        ON hl.TABLE_SCHEMA = h.TABLE_SCHEMA
       AND hl.TABLE_NAME = 'holiday_lists'
      WHERE h.TABLE_NAME = 'holidays'
      ORDER BY (h.TABLE_SCHEMA = DATABASE()) DESC, h.TABLE_SCHEMA ASC
      LIMIT 1
    `
      .then(rows => rows?.[0]?.schema_name || null)
      .catch(() => null)
  }

  return holidayTablesSchemaPromise
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replaceAll('`', '``')}\``
}

function qualifiedTable(schemaName, tableName) {
  return Prisma.raw(`${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`)
}

function normalizeDateForSQL(dateInput) {
  try {
    const d = new Date(dateInput)
    if (Number.isNaN(d.getTime())) return dateInput
    return d.toISOString().slice(0, 10)
  } catch (e) {
    return dateInput
  }
}

function debugLog(...args) {
  try {
    if (process.env.DEBUG_HOLIDAY === 'true') {
      console.log('[holiday-debug]', ...args)
    }
  } catch (e) {
    // ignore
  }
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()
  const errno = Number(error?.errno || error?.meta?.errno || error?.meta?.raw?.errno || 0)

  return (
    message.includes("doesn't exist") ||
    message.includes('does not exist') ||
    message.includes('er_no_such_table') ||
    code === 'er_no_such_table' ||
    errno === 1146
  )
}

export async function getCompanies() {
  const schemaName = await findHolidayTablesSchema()

  if (schemaName) {
    const companiesTable = qualifiedTable(schemaName, 'companies')
    try {
      const companies = await prisma.$queryRaw(
        Prisma.sql`SELECT id, name FROM ${companiesTable} WHERE status = 'Active' ORDER BY name ASC`
      )
      return companies || []
    } catch (error) {
      if (!isMissingTableError(error)) throw error

      // Some legacy holiday schemas do not contain a companies master. Keep
      // those installations usable, but only as a last-resort fallback.
      const holidayListsTable = qualifiedTable(schemaName, 'holiday_lists')
      return prisma.$queryRaw(
        Prisma.sql`SELECT DISTINCT companyId AS id, CAST(companyId AS CHAR) AS name FROM ${holidayListsTable} ORDER BY companyId ASC`
      )
    }
  }

  return []
}

export async function getHolidayLists(companyId) {
  try {
    const where = companyId ? Prisma.sql`WHERE companyId = ${companyId}` : Prisma.empty
    const lists = await prisma.$queryRaw`
      SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt
      FROM holiday_lists
      ${where}
      ORDER BY startDate DESC, id DESC
    `
    return lists
  } catch (error) {
    if (isMissingTableError(error)) {
      // Try to locate holiday_lists in any accessible schema and query it explicitly
      try {
        const [found] = await prisma.$queryRaw`
          SELECT TABLE_SCHEMA as schema_name
          FROM information_schema.tables
          WHERE table_name = 'holiday_lists'
          LIMIT 1
        `
        if (found && found.schema_name) {
          const cid = Number(companyId) || null
          const table = qualifiedTable(found.schema_name, 'holiday_lists')
          const where = cid ? Prisma.sql`WHERE companyId = ${cid}` : Prisma.empty
          const lists = await prisma.$queryRaw(
            Prisma.sql`SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM ${table} ${where} ORDER BY startDate DESC, id DESC`
          )
          return lists || []
        }
        return []
      } catch (e) {
        return []
      }
    }
    throw error
  }
}

export async function searchHolidayLists(field, condition, value, companyId) {
  try {
    const clauses = []
    if (companyId) clauses.push(Prisma.sql`companyId = ${companyId}`)

    if (value && value.toString().trim() !== '') {
      const trimmedValue = value.toString().trim()
      switch (field) {
        case 'name':
          if (condition === 'Like') {
            clauses.push(Prisma.sql`name LIKE ${`%${trimmedValue}%`}`)
          } else {
            clauses.push(Prisma.sql`name = ${trimmedValue}`)
          }
          break
        case 'id':
          if (!isNaN(Number(trimmedValue))) {
            clauses.push(Prisma.sql`id = ${Number(trimmedValue)}`)
          }
          break
        case 'status':
          clauses.push(Prisma.sql`status = ${trimmedValue}`)
          break
        default:
          clauses.push(Prisma.sql`name LIKE ${`%${trimmedValue}%`}`)
      }
    }

    const where = clauses.length > 0 ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}` : Prisma.empty
    const lists = await prisma.$queryRaw`
      SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt
      FROM holiday_lists
      ${where}
      ORDER BY startDate DESC, id DESC
    `
    return lists
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holiday_lists')
        if (schemaName) {
          const sqlClauses = []
          const cid = companyId ? Number(companyId) : null
          if (cid) sqlClauses.push(Prisma.sql`companyId = ${cid}`)

          if (value && value.toString().trim() !== '') {
            const trimmedValue = value.toString().trim()
            switch (field) {
              case 'name':
                if (condition === 'Like') {
                  sqlClauses.push(Prisma.sql`name LIKE ${`%${trimmedValue}%`}`)
                } else {
                  sqlClauses.push(Prisma.sql`name = ${trimmedValue}`)
                }
                break
              case 'id':
                if (!isNaN(Number(trimmedValue))) {
                  sqlClauses.push(Prisma.sql`id = ${Number(trimmedValue)}`)
                }
                break
              case 'status':
                sqlClauses.push(Prisma.sql`status = ${trimmedValue}`)
                break
              default:
                sqlClauses.push(Prisma.sql`name LIKE ${`%${trimmedValue}%`}`)
            }
          }

          const where = sqlClauses.length > 0
            ? Prisma.sql`WHERE ${Prisma.join(sqlClauses, ' AND ')}`
            : Prisma.empty
          const table = qualifiedTable(schemaName, 'holiday_lists')
          const lists = await prisma.$queryRaw(
            Prisma.sql`SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM ${table} ${where} ORDER BY startDate DESC, id DESC`
          )
          return lists || []
        }
        return []
      } catch (e) {
        return []
      }
    }
    throw error
  }
}

export async function getHolidayListById(id) {
  try {
    const [list] = await prisma.$queryRaw`
      SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt
      FROM holiday_lists
      WHERE id = ${id}
      LIMIT 1
    `
    return list
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holiday_lists')
        if (schemaName) {
          const table = qualifiedTable(schemaName, 'holiday_lists')
          const [list] = await prisma.$queryRaw(
            Prisma.sql`SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM ${table} WHERE id = ${Number(id)} LIMIT 1`
          )
          return list
        }
        return null
      } catch (e) {
        return null
      }
    }
    throw error
  }
}

export async function checkHolidayListNameUnique(name, companyId, excludeId = null) {
  try {
    const clause = excludeId ? Prisma.sql`AND id != ${excludeId}` : Prisma.empty
    const [existing] = await prisma.$queryRaw`
      SELECT id
      FROM holiday_lists
      WHERE name = ${name} AND companyId = ${companyId}
      ${clause}
      LIMIT 1
    `
    return !existing
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holiday_lists')
        if (schemaName) {
          const exclude = excludeId ? Prisma.sql`AND id != ${Number(excludeId)}` : Prisma.empty
          const table = qualifiedTable(schemaName, 'holiday_lists')
          const [existing] = await prisma.$queryRaw(
            Prisma.sql`SELECT id FROM ${table} WHERE name = ${name} AND companyId = ${Number(companyId)} ${exclude} LIMIT 1`
          )
          return !existing
        }
        return true
      } catch (e) {
        return true
      }
    }
    throw error
  }
}

export async function checkHolidayListOverlap(startDate, endDate, companyId, excludeId = null) {
  const sDate = normalizeDateForSQL(startDate)
  const eDate = normalizeDateForSQL(endDate)
  try {
    const clause = excludeId ? Prisma.sql`AND id != ${excludeId}` : Prisma.empty
    debugLog('checkHolidayListOverlap params', { startDate, endDate, sDate, eDate, companyId, excludeId })

    // Fetch active lists for the company and perform overlap check in JS to avoid
    // SQL date-format and timezone comparison issues.
    const rows = await prisma.$queryRaw`
      SELECT id, startDate, endDate
      FROM holiday_lists
      WHERE companyId = ${companyId}
        AND status = 'Active'
      ${clause}
    `

    debugLog('checkHolidayListOverlap fetched rows (default schema)', rows)

    for (const r of rows || []) {
      const existingId = Number(r.id)
      if (excludeId && existingId === Number(excludeId)) continue
      const existingStart = normalizeDateForSQL(r.startDate)
      const existingEnd = normalizeDateForSQL(r.endDate)
      // Overlap exists unless existingEnd < newStart OR existingStart > newEnd
      if (!(existingEnd < sDate || existingStart > eDate)) {
        debugLog('checkHolidayListOverlap found overlap with', { existingId, existingStart, existingEnd })
        return false
      }
    }
    return true
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holiday_lists')
        if (schemaName) {
          const exclude = excludeId ? Prisma.sql`AND id != ${Number(excludeId)}` : Prisma.empty
          const table = qualifiedTable(schemaName, 'holiday_lists')
          const rows = await prisma.$queryRaw(
            Prisma.sql`SELECT id, startDate, endDate FROM ${table} WHERE companyId = ${Number(companyId)} AND status = 'Active' ${exclude}`
          )
          debugLog('checkHolidayListOverlap fetched rows (cross-schema)', rows)
          for (const r of rows || []) {
            const existingId = Number(r.id)
            if (excludeId && existingId === Number(excludeId)) continue
            const existingStart = normalizeDateForSQL(r.startDate)
            const existingEnd = normalizeDateForSQL(r.endDate)
            if (!(existingEnd < sDate || existingStart > eDate)) {
              debugLog('checkHolidayListOverlap found cross-schema overlap with', { existingId, existingStart, existingEnd })
              return false
            }
          }
          return true
        }
        return true
      } catch (e) {
        return true
      }
    }
    throw error
  }
}

export async function createHolidayList(payload) {
  try {
    const sDate = normalizeDateForSQL(payload.startDate)
    const eDate = normalizeDateForSQL(payload.endDate)
    const isNameUnique = await checkHolidayListNameUnique(payload.name, payload.companyId)
    if (!isNameUnique) {
      throw new Error('List Name must be unique for the selected company.')
    }

    if (payload.status === 'Active') {
      const isNotOverlapping = await checkHolidayListOverlap(sDate, eDate, payload.companyId)
      if (!isNotOverlapping) {
        throw new Error('An active holiday list overlaps with this period for the selected company.')
      }
    }

    await prisma.$executeRaw`
      INSERT INTO holiday_lists (name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt)
      VALUES (${payload.name}, ${sDate}, ${eDate}, ${JSON.stringify(payload.weekOffs)}, ${payload.status}, ${payload.companyId}, NOW(), NOW())
    `
    const [created] = await prisma.$queryRaw`
      SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt
      FROM holiday_lists
      WHERE id = LAST_INSERT_ID()
      LIMIT 1
    `
    return created
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        debugLog('createHolidayList: missing table in default schema, original error', String(error?.message || error))
        const schemas = await findTableSchemas('holiday_lists')
        debugLog('createHolidayList: candidate schemas', schemas)
        const sDate = normalizeDateForSQL(payload.startDate)
        const eDate = normalizeDateForSQL(payload.endDate)
        for (const schemaName of schemas) {
          try {
            const table = qualifiedTable(schemaName, 'holiday_lists')
            const created = await prisma.$transaction(async tx => {
              await tx.$executeRaw(
                Prisma.sql`INSERT INTO ${table} (name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt) VALUES (${payload.name}, ${sDate}, ${eDate}, ${JSON.stringify(payload.weekOffs)}, ${payload.status}, ${Number(payload.companyId)}, NOW(), NOW())`
              )
              const [row] = await tx.$queryRaw(
                Prisma.sql`SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM ${table} WHERE id = LAST_INSERT_ID() LIMIT 1`
              )
              return row
            })
            debugLog('createHolidayList: created row', created)
            return created
          } catch (innerErr) {
            debugLog('createHolidayList: insert failed for schema', schemaName, String(innerErr?.message || innerErr))
            // try next schema
          }
        }
        // none succeeded
        debugLog('createHolidayList: no schema succeeded for insert')
        throw new Error('Holiday list feature is unavailable because the holiday_lists table is missing.')
      } catch (e) {
        throw new Error('Holiday list feature is unavailable because the holiday_lists table is missing.')
      }
    }
    throw error
  }
}

export async function updateHolidayList(id, payload) {
  const sDate = normalizeDateForSQL(payload.startDate)
  const eDate = normalizeDateForSQL(payload.endDate)
  try {
    const isNameUnique = await checkHolidayListNameUnique(payload.name, payload.companyId, id)
    if (!isNameUnique) {
      throw new Error('List Name must be unique for the selected company.')
    }

    if (payload.status === 'Active') {
      const isNotOverlapping = await checkHolidayListOverlap(sDate, eDate, payload.companyId, id)
      if (!isNotOverlapping) {
        throw new Error('An active holiday list overlaps with this period for the selected company.')
      }
    }

    await prisma.$executeRaw`
      UPDATE holiday_lists
      SET name = ${payload.name}, startDate = ${sDate}, endDate = ${eDate}, weekOffs = ${JSON.stringify(payload.weekOffs)}, status = ${payload.status}, companyId = ${payload.companyId}, updatedAt = NOW()
      WHERE id = ${id}
    `
    const [updated] = await prisma.$queryRaw`
      SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt
      FROM holiday_lists
      WHERE id = ${id}
      LIMIT 1
    `
    return updated
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holiday_lists')
        if (schemaName) {
          const table = qualifiedTable(schemaName, 'holiday_lists')
          await prisma.$executeRaw(
            Prisma.sql`UPDATE ${table} SET name = ${payload.name}, startDate = ${sDate}, endDate = ${eDate}, weekOffs = ${JSON.stringify(payload.weekOffs)}, status = ${payload.status}, companyId = ${Number(payload.companyId)}, updatedAt = NOW() WHERE id = ${Number(id)}`
          )
          const [updated] = await prisma.$queryRaw(
            Prisma.sql`SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM ${table} WHERE id = ${Number(id)} LIMIT 1`
          )
          return updated
        }
        throw new Error('Holiday list feature is unavailable because the holiday_lists table is missing.')
      } catch (e) {
        throw new Error('Holiday list feature is unavailable because the holiday_lists table is missing.')
      }
    }
    throw error
  }
}

export async function hasHolidaysForList(id) {
  try {
    const [result] = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM holidays
      WHERE holidayListId = ${id}
    `
    return result?.count > 0
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holidays')
        if (schemaName) {
          const table = qualifiedTable(schemaName, 'holidays')
          const [result] = await prisma.$queryRaw(
            Prisma.sql`SELECT COUNT(*) as count FROM ${table} WHERE holidayListId = ${Number(id)}`
          )
          return result?.count > 0
        }
        return false
      } catch (e) {
        return false
      }
    }
    throw error
  }
}

export async function deleteHolidayList(id) {
  try {
    if (await hasHolidaysForList(id)) {
      throw new Error('This holiday list contains holidays and cannot be deleted until all holidays are removed.')
    }
    await prisma.$executeRaw`
      DELETE FROM holiday_lists
      WHERE id = ${id}
    `
    return true
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holiday_lists')
        if (schemaName) {
          if (await hasHolidaysForList(id)) {
            throw new Error('This holiday list contains holidays and cannot be deleted until all holidays are removed.')
          }
          const table = qualifiedTable(schemaName, 'holiday_lists')
          await prisma.$executeRaw(
            Prisma.sql`DELETE FROM ${table} WHERE id = ${Number(id)}`
          )
          return true
        }
        return []
      } catch (e) {
        return []
      }
    }
    throw error
  }
}

export async function getHolidaysByListId(holidayListId) {
  try {
    const holidays = await prisma.$queryRaw`
      SELECT id, date, description, type, holidayListId, createdAt, updatedAt
      FROM holidays
      WHERE holidayListId = ${holidayListId}
      ORDER BY date ASC
    `
    return holidays
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holidays')
        if (schemaName) {
          const table = qualifiedTable(schemaName, 'holidays')
          const holidays = await prisma.$queryRaw(
            Prisma.sql`SELECT id, date, description, type, holidayListId, createdAt, updatedAt FROM ${table} WHERE holidayListId = ${Number(holidayListId)} ORDER BY date ASC`
          )
          return holidays || []
        }
        return []
      } catch (e) {
        return []
      }
    }
    throw error
  }
}

export async function checkHolidayDuplicate(date, holidayListId, excludeId = null) {
  try {
    const clause = excludeId ? Prisma.sql`AND id != ${excludeId}` : Prisma.empty
    const [existing] = await prisma.$queryRaw`
      SELECT id
      FROM holidays
      WHERE date = ${date} AND holidayListId = ${holidayListId}
      ${clause}
      LIMIT 1
    `
    return !existing
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holidays')
        if (schemaName) {
          const exclude = excludeId ? Prisma.sql`AND id != ${Number(excludeId)}` : Prisma.empty
          const table = qualifiedTable(schemaName, 'holidays')
          const [existing] = await prisma.$queryRaw(
            Prisma.sql`SELECT id FROM ${table} WHERE date = ${date} AND holidayListId = ${Number(holidayListId)} ${exclude} LIMIT 1`
          )
          return !existing
        }
        return true
      } catch (e) {
        return true
      }
    }
    throw error
  }
}

export async function createHoliday(payload) {
  try {
    await prisma.$executeRaw`
      INSERT INTO holidays (date, description, type, holidayListId, createdAt, updatedAt)
      VALUES (${payload.date}, ${payload.description}, 'Holiday', ${payload.holidayListId}, NOW(), NOW())
    `
    const [created] = await prisma.$queryRaw`
      SELECT id, date, description, type, holidayListId, createdAt, updatedAt
      FROM holidays
      WHERE id = LAST_INSERT_ID()
      LIMIT 1
    `
    return created
  } catch (error) {
    if (isMissingTableError(error)) {
      // Try to find the holidays table in any schema and insert there
      try {
        const schemaName = await findTableSchema('holidays')
        if (schemaName) {
          const table = qualifiedTable(schemaName, 'holidays')
          const created = await prisma.$transaction(async tx => {
            await tx.$executeRaw(
              Prisma.sql`INSERT INTO ${table} (date, description, type, holidayListId, createdAt, updatedAt) VALUES (${payload.date}, ${payload.description}, 'Holiday', ${Number(payload.holidayListId)}, NOW(), NOW())`
            )
            const [row] = await tx.$queryRaw(
              Prisma.sql`SELECT id, date, description, type, holidayListId, createdAt, updatedAt FROM ${table} WHERE id = LAST_INSERT_ID() LIMIT 1`
            )
            return row
          })
          return created
        }
        throw new Error('Holiday creation is unavailable because the holidays table is missing.')
      } catch (e) {
        throw new Error('Holiday creation is unavailable because the holidays table is missing.')
      }
    }
    throw error
  }
}

export async function updateHoliday(id, payload) {
  try {
    await prisma.$executeRaw`
      UPDATE holidays
      SET date = ${payload.date}, description = ${payload.description}, updatedAt = NOW()
      WHERE id = ${id}
    `
    const [updated] = await prisma.$queryRaw`
      SELECT id, date, description, type, holidayListId, createdAt, updatedAt
      FROM holidays
      WHERE id = ${id}
      LIMIT 1
    `
    return updated
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holidays')
        if (schemaName) {
          const table = qualifiedTable(schemaName, 'holidays')
          await prisma.$executeRaw(
            Prisma.sql`UPDATE ${table} SET date = ${payload.date}, description = ${payload.description}, updatedAt = NOW() WHERE id = ${Number(id)}`
          )
          const [updated] = await prisma.$queryRaw(
            Prisma.sql`SELECT id, date, description, type, holidayListId, createdAt, updatedAt FROM ${table} WHERE id = ${Number(id)} LIMIT 1`
          )
          return updated
        }
        throw new Error('Holiday update is unavailable because the holidays table is missing.')
      } catch (e) {
        throw new Error('Holiday update is unavailable because the holidays table is missing.')
      }
    }
    throw error
  }
}

export async function deleteHoliday(id) {
  try {
    await prisma.$executeRaw`
      DELETE FROM holidays
      WHERE id = ${id}
    `
    return true
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holidays')
        if (schemaName) {
          const table = qualifiedTable(schemaName, 'holidays')
          await prisma.$executeRaw(
            Prisma.sql`DELETE FROM ${table} WHERE id = ${Number(id)}`
          )
          return true
        }
        throw new Error('Holiday deletion is unavailable because the holidays table is missing.')
      } catch (e) {
        throw new Error('Holiday deletion is unavailable because the holidays table is missing.')
      }
    }
    throw error
  }
}

export async function isHoliday(dateString) {
  try {
    const schemaName = await findHolidayTablesSchema()
    if (!schemaName) return null

    const sql = Prisma.sql`
      SELECT h.id, h.description, h.type
      FROM ${Prisma.raw(`${quoteIdentifier(schemaName)}.${quoteIdentifier('holidays')}`)} h
      INNER JOIN ${Prisma.raw(`${quoteIdentifier(schemaName)}.${quoteIdentifier('holiday_lists')}`)} hl
        ON hl.id = h.holidayListId
      WHERE h.date = ${normalizeDateForSQL(dateString)}
        AND hl.status = 'Active'
        AND h.date BETWEEN hl.startDate AND hl.endDate
      LIMIT 1
    `
    const [result] = await prisma.$queryRaw(sql)
    return result || null
  } catch (error) {
    if (isMissingTableError(error)) return null
    throw error
  }
}

export async function getAllHolidayDates() {
  try {
    const schemaName = await findHolidayTablesSchema()
    if (!schemaName) return []

    const sql = Prisma.sql`
      SELECT h.date
      FROM ${Prisma.raw(`${quoteIdentifier(schemaName)}.${quoteIdentifier('holidays')}`)} h
      INNER JOIN ${Prisma.raw(`${quoteIdentifier(schemaName)}.${quoteIdentifier('holiday_lists')}`)} hl
        ON hl.id = h.holidayListId
      WHERE hl.status = 'Active'
        AND h.date BETWEEN hl.startDate AND hl.endDate
    `
    const holidays = await prisma.$queryRaw(sql)
    return (holidays || []).map(h => h.date)
  } catch (error) {
    if (isMissingTableError(error)) return []
    throw error
  }
}

export async function bulkCreateHolidays(holidayListId, records) {
  let inserted = 0
  for (const record of records) {
    if (!record.date || !record.description) continue
    try {
      await createHoliday({
        holidayListId: Number(holidayListId),
        date: record.date,
        description: String(record.description).trim()
      })
      inserted++
    } catch (e) {
      console.error(`Skipping holiday ${record.date}:`, e)
    }
  }
  return inserted
}


