import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const source = path => readFile(new URL(path, root), 'utf8')

test('report catalog exposes all 25 final-format reports and ten completed gap routes', async () => {
  const catalog = await source('src/lib/reports/finalReportCatalog.js')
  assert.equal((catalog.match(/href: '/g) || []).length, 25)
  assert.equal((catalog.match(/: \{ title: /g) || []).length, 10)
  assert.doesNotMatch(catalog, /coming soon/i)
})

test('critical report calculations use the corrected production rules', async () => {
  const [abstractQuery, lowEfficiency, spinningStoppage, waste] = await Promise.all([
    source('src/app/reports/autoconer/abstract/autoconerAbstractReportQueries.js'),
    source('src/lib/queries/autoconerLowEfficiencyReportQueries.js'),
    source('src/lib/queries/spinningStoppageReportQueries.js'),
    source('src/lib/queries/preparatoryWasteReportQueries.js')
  ])

  assert.doesNotMatch(abstractQuery, /d\.run_time \/ d\.work_time/)
  assert.match(abstractQuery, /d\.work_time \/ NULLIF\(d\.run_time, 0\)/)
  assert.match(lowEfficiency, /filter\(item => item\?\.is_low_efficiency\)/)
  assert.match(spinningStoppage, /shift === 3 \? 420 : 510/)
  assert.match(waste, /getUpToDateRange\(toDate\)/)
})

test('final report PDF layout keeps the compact reference hierarchy', async () => {
  const layout = await source('src/lib/reports/pdfLayout.js')
  assert.match(layout, /KAYAAR EXPORTS PRIVATE LIMITED/)
  assert.match(layout, /accent: \[145, 32, 38\]/)
  assert.match(layout, /fontSize: report\.orientation === 'landscape' \? 6\.7 : 7\.2/)
  assert.match(layout, /Page \$\{page\} of \$\{totalPages\}/)
})
