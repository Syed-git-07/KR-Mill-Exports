const { Prisma, PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const modules = [
  { name: 'Autoconer', header: 'autoconer_production_header', detail: 'autoconer_production_detail', stoppage: 'autoconer_stoppage_entry', machine: 'autoconer_machines', setup: 'autoconer_machine_setup' },
  { name: 'Breaker Drawing', header: 'breaker_drawing_production_header', detail: 'breaker_drawing_production_detail', stoppage: 'breaker_drawing_stoppage_entry', machine: 'drawing_breaker_machines', setup: 'breaker_drawing_machine_setup' },
  { name: 'Carding', header: 'carding_production_header', detail: 'carding_production_detail', stoppage: 'carding_stoppage_entry', machine: 'carding_machines', setup: 'carding_machine_setup' },
  { name: 'Comber', header: 'comber_production_header', detail: 'comber_production_detail', stoppage: 'comber_stoppage_entry', machine: 'comber_machines', setup: 'comber_machine_setup' },
  { name: 'Finisher Drawing', header: 'finisher_drawing_production_header', detail: 'finisher_drawing_production_detail', stoppage: 'finisher_drawing_stoppage_entry', machine: 'drawing_finisher_machines', setup: 'finisher_drawing_machine_setup' },
  { name: 'Lap Former', header: 'lap_former_production_header', detail: 'lap_former_production_detail', stoppage: 'lap_former_stoppage_entry', machine: 'lap_former_machines', setup: 'lap_former_machine_setup' },
  { name: 'Simplex', header: 'simplex_production_header', detail: 'simplex_production_detail', stoppage: 'simplex_stoppage_entry', machine: 'simplex_machines', setup: 'simplex_machine_setup', detailHasStoppageTotal: false },
  { name: 'Spinning', header: 'spinning_production_header', detail: 'spinning_production_detail', stoppage: 'spinning_stoppage_entry', machine: 'spinning_machines', setup: 'spinning_machine_setup' }
]

function asNumber(value) {
  return Number(value || 0)
}

async function scalar(sql) {
  // Every identifier comes from the fixed module registry above; no user input
  // is accepted by this read-only maintenance command.
  const [row] = await prisma.$queryRaw(Prisma.raw(sql))
  return asNumber(row?.value)
}

async function auditModule(config) {
  const { header, detail, stoppage, machine, setup } = config
  const reasonReference = [1, 2, 3, 4]
    .map(slot => `s.stoppage${slot}_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM stoppage_details r WHERE r.id = s.stoppage${slot}_id)`)
    .join(' OR ')

  const result = {
    module: config.name,
    rows: {
      headers: await scalar(`SELECT COUNT(*) AS value FROM \`${header}\``),
      details: await scalar(`SELECT COUNT(*) AS value FROM \`${detail}\``),
      stoppages: await scalar(`SELECT COUNT(*) AS value FROM \`${stoppage}\``)
    },
    migrationBlockers: {
      duplicateDateShiftGroups: await scalar(`SELECT COUNT(*) AS value FROM (SELECT entry_date, shift FROM \`${header}\` GROUP BY entry_date, shift HAVING COUNT(*) > 1) duplicate_groups`),
      duplicateHeaderMachineGroups: await scalar(`SELECT COUNT(*) AS value FROM (SELECT header_id, machine_id FROM \`${detail}\` GROUP BY header_id, machine_id HAVING COUNT(*) > 1) duplicate_groups`),
      duplicateStoppageDetailGroups: await scalar(`SELECT COUNT(*) AS value FROM (SELECT production_detail_id FROM \`${stoppage}\` GROUP BY production_detail_id HAVING COUNT(*) > 1) duplicate_groups`)
    },
    historicalWarnings: {
      detailsMissingMachine: await scalar(`SELECT COUNT(*) AS value FROM \`${detail}\` d LEFT JOIN \`${machine}\` m ON m.id = d.machine_id WHERE m.id IS NULL`),
      orphanStoppages: await scalar(`SELECT COUNT(*) AS value FROM \`${stoppage}\` s LEFT JOIN \`${detail}\` d ON d.id = s.production_detail_id WHERE d.id IS NULL`),
      orphanSetups: await scalar(`SELECT COUNT(*) AS value FROM \`${setup}\` s LEFT JOIN \`${machine}\` m ON m.id = s.machine_id WHERE m.id IS NULL`),
      stoppagesMissingReason: await scalar(`SELECT COUNT(*) AS value FROM \`${stoppage}\` s WHERE ${reasonReference}`),
      incorrectStoppageTotals: await scalar(`SELECT COUNT(*) AS value FROM \`${stoppage}\` WHERE COALESCE(total_stoppage_time, 0) <> COALESCE(stoppage1_time, 0) + COALESCE(stoppage2_time, 0) + COALESCE(stoppage3_time, 0) + COALESCE(stoppage4_time, 0)`)
    }
  }

  if (config.detailHasStoppageTotal !== false) {
    result.historicalWarnings.detailStoppageTotalMismatch = await scalar(
      `SELECT COUNT(*) AS value FROM \`${detail}\` d INNER JOIN \`${stoppage}\` s ON s.production_detail_id = d.id WHERE COALESCE(d.total_stoppage_mins, 0) <> COALESCE(s.total_stoppage_time, 0)`
    )
  }

  return result
}

async function main() {
  const results = []
  for (const config of modules) {
    results.push(await auditModule(config))
  }

  const blockingIssues = results.reduce(
    (total, result) => total + Object.values(result.migrationBlockers).reduce((sum, value) => sum + value, 0),
    0
  )
  const warnings = results.reduce(
    (total, result) => total + Object.values(result.historicalWarnings).reduce((sum, value) => sum + value, 0),
    0
  )

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    readOnly: true,
    blockingIssues,
    warnings,
    modules: results
  }, null, 2))

  if (blockingIssues > 0) {
    console.error('Integrity migration is blocked: resolve duplicate groups before applying database constraints.')
    process.exitCode = 2
  }
}

main()
  .catch(error => {
    console.error(`Integrity audit failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
