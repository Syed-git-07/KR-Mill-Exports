const { Prisma, PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const backupTable = 'spinning_stoppage_entry_duplicate_backup_20260803'

function asNumber(value) {
  return Number(value || 0)
}

async function getDuplicateSummary() {
  const [summary] = await prisma.$queryRaw(Prisma.raw(`
    SELECT
      COUNT(*) AS duplicate_groups,
      COALESCE(SUM(row_count - 1), 0) AS duplicate_rows,
      COALESCE(SUM(CASE WHEN value_variants > 1 THEN 1 ELSE 0 END), 0) AS conflicting_groups
    FROM (
      SELECT production_detail_id, COUNT(*) AS row_count,
        COUNT(DISTINCT CONCAT_WS('|',
          COALESCE(run_time, ''), COALESCE(stoppage1_id, ''), COALESCE(stoppage1_time, ''),
          COALESCE(stoppage2_id, ''), COALESCE(stoppage2_time, ''),
          COALESCE(stoppage3_id, ''), COALESCE(stoppage3_time, ''),
          COALESCE(stoppage4_id, ''), COALESCE(stoppage4_time, ''),
          COALESCE(total_stoppage_time, ''), COALESCE(is_full_stoppage, '')
        )) AS value_variants
      FROM spinning_stoppage_entry
      GROUP BY production_detail_id
      HAVING COUNT(*) > 1
    ) duplicate_groups
  `))

  return {
    duplicateGroups: asNumber(summary?.duplicate_groups),
    duplicateRows: asNumber(summary?.duplicate_rows),
    conflictingGroups: asNumber(summary?.conflicting_groups)
  }
}

async function uniqueConstraintExists() {
  const [row] = await prisma.$queryRaw(Prisma.raw(`
    SELECT COUNT(*) AS value
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'spinning_stoppage_entry'
      AND INDEX_NAME = 'uk_spinning_stoppage_detail'
      AND NON_UNIQUE = 0
  `))
  return asNumber(row?.value) > 0
}

async function repairIdenticalDuplicates() {
  await prisma.$executeRaw(Prisma.raw(`
    CREATE TABLE IF NOT EXISTS \`${backupTable}\` LIKE spinning_stoppage_entry
  `))

  // Keep the newest row in each group. Every row selected for removal is first
  // copied to a permanent backup table using its original primary key.
  await prisma.$executeRaw(Prisma.raw(`
    INSERT IGNORE INTO \`${backupTable}\`
    SELECT older.*
    FROM spinning_stoppage_entry older
    INNER JOIN spinning_stoppage_entry newer
      ON newer.production_detail_id = older.production_detail_id
      AND (
        COALESCE(newer.updated_at, '1970-01-01') > COALESCE(older.updated_at, '1970-01-01')
        OR (
          COALESCE(newer.updated_at, '1970-01-01') = COALESCE(older.updated_at, '1970-01-01')
          AND COALESCE(newer.created_at, '1970-01-01') > COALESCE(older.created_at, '1970-01-01')
        )
        OR (
          COALESCE(newer.updated_at, '1970-01-01') = COALESCE(older.updated_at, '1970-01-01')
          AND COALESCE(newer.created_at, '1970-01-01') = COALESCE(older.created_at, '1970-01-01')
          AND newer.id > older.id
        )
      )
  `))

  await prisma.$transaction(async tx => {
    await tx.$executeRaw(Prisma.raw(`
      DELETE source
      FROM spinning_stoppage_entry source
      INNER JOIN \`${backupTable}\` backup ON backup.id = source.id
    `))
  })
}

async function main() {
  const before = await getDuplicateSummary()
  const constraintBefore = await uniqueConstraintExists()

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    backupTable,
    before,
    uniqueConstraintPresent: constraintBefore
  }, null, 2))

  if (!apply) {
    console.log('Dry run only. Re-run with --apply after taking a full database backup.')
    return
  }
  if (before.conflictingGroups > 0) {
    throw new Error('Repair stopped: duplicate groups contain different stoppage values and require manual review')
  }

  if (before.duplicateRows > 0) await repairIdenticalDuplicates()
  const afterDelete = await getDuplicateSummary()
  if (afterDelete.duplicateRows > 0) {
    throw new Error('Repair stopped: duplicate rows remain after the backed-up cleanup')
  }

  if (!(await uniqueConstraintExists())) {
    await prisma.$executeRaw(Prisma.raw(`
      ALTER TABLE spinning_stoppage_entry
        ADD CONSTRAINT uk_spinning_stoppage_detail UNIQUE (production_detail_id)
    `))
  }

  console.log(JSON.stringify({
    repaired: true,
    removedDuplicateRows: before.duplicateRows,
    backupTable,
    after: await getDuplicateSummary(),
    uniqueConstraintPresent: await uniqueConstraintExists()
  }, null, 2))
}

main()
  .catch(error => {
    console.error(`Spinning stoppage repair failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
