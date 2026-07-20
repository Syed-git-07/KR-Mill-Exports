'use client'

import DateShiftListPage from '@/components/modules/common/DateShiftListPage'

export default function SimplexDateListPage() {
  return (
    <DateShiftListPage
      moduleName="Simplex"
      tableName="simplex_production_header"
      entryPath="/preparatory-entry/simplex/entry"
    />
  )
}
