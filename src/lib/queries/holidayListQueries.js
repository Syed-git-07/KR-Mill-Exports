import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

async function findTableSchema(tableName) {
  try {
    const [found] = await prisma.$queryRaw`
      SELECT TABLE_SCHEMA as schema_name
      FROM information_schema.tables
      WHERE table_name = ${tableName}
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
      ORDER BY TABLE_SCHEMA ASC
    `
    return (rows || []).map(r => r.schema_name).filter(Boolean)
  } catch (e) {
    return []
  }
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
  try {
    const companies = await prisma.$queryRaw`
      SELECT id, name
      FROM companies
      WHERE status = 'Active'
      ORDER BY name ASC
    `
    return companies
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        // Try to locate holiday_lists in any accessible schema and query it explicitly
        const [found] = await prisma.$queryRaw`
          SELECT TABLE_SCHEMA as schema_name
          FROM information_schema.tables
          WHERE table_name = 'holiday_lists'
          LIMIT 1
        `
        if (found && found.schema_name) {
          const schemaName = found.schema_name
          const fallbackSql = `SELECT DISTINCT companyId AS id, CAST(companyId AS CHAR) AS name FROM \`${schemaName}\`.holiday_lists ORDER BY companyId ASC`
          const fallback = await prisma.$queryRawUnsafe(fallbackSql)
          return fallback || []
        }
        return []
      } catch (fallbackError) {
        if (isMissingTableError(fallbackError)) return []
        throw fallbackError
      }
    }
    throw error
  }
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
          const schemaName = found.schema_name
          const cid = Number(companyId) || null
          const whereClause = cid ? `WHERE companyId = ${cid}` : ''
          const sql = `SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM \`${schemaName}\`.holiday_lists ${whereClause} ORDER BY startDate DESC, id DESC`
          const lists = await prisma.$queryRawUnsafe(sql)
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
          if (cid) sqlClauses.push(`companyId = ${cid}`)

          if (value && value.toString().trim() !== '') {
            const trimmedValue = value.toString().trim()
            const escaped = trimmedValue.replace(/'/g, "''")
            switch (field) {
              case 'name':
                if (condition === 'Like') {
                  sqlClauses.push(`name LIKE '%${escaped}%'`)
                } else {
                  sqlClauses.push(`name = '${escaped}'`)
                }
                break
              case 'id':
                if (!isNaN(Number(trimmedValue))) {
                  sqlClauses.push(`id = ${Number(trimmedValue)}`)
                }
                break
              case 'status':
                sqlClauses.push(`status = '${escaped}'`)
                break
              default:
                sqlClauses.push(`name LIKE '%${escaped}%'`)
            }
          }

          const whereClause = sqlClauses.length > 0 ? `WHERE ${sqlClauses.join(' AND ')}` : ''
          const sql = `SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM \`${schemaName}\`.holiday_lists ${whereClause} ORDER BY startDate DESC, id DESC`
          const lists = await prisma.$queryRawUnsafe(sql)
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
          const sql = `SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM \`${schemaName}\`.holiday_lists WHERE id = ${Number(id)} LIMIT 1`
          const [list] = await prisma.$queryRawUnsafe(sql)
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
          const ex = excludeId ? `AND id != ${Number(excludeId)}` : ''
          const sql = `SELECT id FROM \`${schemaName}\`.holiday_lists WHERE name = ${JSON.stringify(name)} AND companyId = ${Number(companyId)} ${ex} LIMIT 1`
          const [existing] = await prisma.$queryRawUnsafe(sql)
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
          const ex = excludeId ? `AND id != ${Number(excludeId)}` : ''
          const sql = `SELECT id, startDate, endDate FROM \`${schemaName}\`.holiday_lists WHERE companyId = ${Number(companyId)} AND status = 'Active' ${ex}`
          debugLog('checkHolidayListOverlap cross-schema SQL', sql)
          const rows = await prisma.$queryRawUnsafe(sql)
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
            const insertSql = `INSERT INTO \`${schemaName}\`.holiday_lists (name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt) VALUES (${JSON.stringify(payload.name)}, '${sDate}', '${eDate}', '${JSON.stringify(payload.weekOffs)}', ${JSON.stringify(payload.status)}, ${Number(payload.companyId)}, NOW(), NOW())`
            debugLog('createHolidayList: trying insert SQL', insertSql)
            await prisma.$executeRawUnsafe(insertSql)
            const selectSql = `SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM \`${schemaName}\`.holiday_lists WHERE id = LAST_INSERT_ID() LIMIT 1`
            const [created] = await prisma.$queryRawUnsafe(selectSql)
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
          const updateSql = `UPDATE \`${schemaName}\`.holiday_lists SET name = ${JSON.stringify(payload.name)}, startDate = '${sDate}', endDate = '${eDate}', weekOffs = '${JSON.stringify(payload.weekOffs)}', status = ${JSON.stringify(payload.status)}, companyId = ${Number(payload.companyId)}, updatedAt = NOW() WHERE id = ${Number(id)}`
          await prisma.$executeRawUnsafe(updateSql)
          const selectSql = `SELECT id, name, startDate, endDate, weekOffs, status, companyId, createdAt, updatedAt FROM \`${schemaName}\`.holiday_lists WHERE id = ${Number(id)} LIMIT 1`
          const [updated] = await prisma.$queryRawUnsafe(selectSql)
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
          const [result] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM \`${schemaName}\`.holidays WHERE holidayListId = ${Number(id)}`)
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
          const delSql = `DELETE FROM \`${schemaName}\`.holiday_lists WHERE id = ${Number(id)}`
          await prisma.$executeRawUnsafe(delSql)
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
          const sql = `SELECT id, date, description, type, holidayListId, createdAt, updatedAt FROM \`${schemaName}\`.holidays WHERE holidayListId = ${Number(holidayListId)} ORDER BY date ASC`
          const holidays = await prisma.$queryRawUnsafe(sql)
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
          const ex = excludeId ? `AND id != ${Number(excludeId)}` : ''
          const sql = `SELECT id FROM \`${schemaName}\`.holidays WHERE date = '${date}' AND holidayListId = ${Number(holidayListId)} ${ex} LIMIT 1`
          const [existing] = await prisma.$queryRawUnsafe(sql)
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
          const insertSql = `INSERT INTO \`${schemaName}\`.holidays (date, description, type, holidayListId, createdAt, updatedAt) VALUES ('${payload.date}', ${JSON.stringify(payload.description)}, 'Holiday', ${Number(payload.holidayListId)}, NOW(), NOW())`
          await prisma.$executeRawUnsafe(insertSql)
          const selectSql = `SELECT id, date, description, type, holidayListId, createdAt, updatedAt FROM \`${schemaName}\`.holidays WHERE id = LAST_INSERT_ID() LIMIT 1`
          const [created] = await prisma.$queryRawUnsafe(selectSql)
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
          const updateSql = `UPDATE \`${schemaName}\`.holidays SET date = '${payload.date}', description = ${JSON.stringify(payload.description)}, updatedAt = NOW() WHERE id = ${Number(id)}`
          await prisma.$executeRawUnsafe(updateSql)
          const selectSql = `SELECT id, date, description, type, holidayListId, createdAt, updatedAt FROM \`${schemaName}\`.holidays WHERE id = ${Number(id)} LIMIT 1`
          const [updated] = await prisma.$queryRawUnsafe(selectSql)
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
          const delSql = `DELETE FROM \`${schemaName}\`.holidays WHERE id = ${Number(id)}`
          await prisma.$executeRawUnsafe(delSql)
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
    const formattedDate = normalizeDateForSQL(dateString)
    const [result] = await prisma.$queryRaw`
      SELECT h.id, h.description, h.type
      FROM holidays h
      INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
      WHERE h.date = ${formattedDate}
        AND hl.status = 'Active'
        AND h.date BETWEEN hl.startDate AND hl.endDate
      LIMIT 1
    `
    return result || null
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holidays')
        if (schemaName) {
          const sql = `SELECT h.id, h.description, h.type FROM \`${schemaName}\`.holidays h INNER JOIN \`${schemaName}\`.holiday_lists hl ON hl.id = h.holidayListId WHERE h.date = '${normalizeDateForSQL(dateString)}' AND hl.status = 'Active' AND h.date BETWEEN hl.startDate AND hl.endDate LIMIT 1`
          const [result] = await prisma.$queryRawUnsafe(sql)
          return result || null
        }
        return null
      } catch (e) {
        return null
      }
    }
    throw error
  }
}

export async function getAllHolidayDates() {
  try {
    const holidays = await prisma.$queryRaw`
      SELECT h.date
      FROM holidays h
      INNER JOIN holiday_lists hl ON hl.id = h.holidayListId
      WHERE hl.status = 'Active'
        AND h.date BETWEEN hl.startDate AND hl.endDate
    `
    return (holidays || []).map(h => h.date)
  } catch (error) {
    if (isMissingTableError(error)) {
      try {
        const schemaName = await findTableSchema('holidays')
        if (schemaName) {
          const sql = `SELECT h.date FROM \`${schemaName}\`.holidays h INNER JOIN \`${schemaName}\`.holiday_lists hl ON hl.id = h.holidayListId WHERE hl.status = 'Active' AND h.date BETWEEN hl.startDate AND hl.endDate`
          const holidays = await prisma.$queryRawUnsafe(sql)
          return (holidays || []).map(h => h.date)
        }
        return []
      } catch (e) {
        return []
      }
    }
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


