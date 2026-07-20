'use client'

import DateShiftListPage from '@/components/modules/common/DateShiftListPage'

export default function CardingDateListPage() {
  return (
    <DateShiftListPage
      moduleName="Carding Entry"
      tableName="carding_production_header"
      entryPath="/preparatory-entry/carding/entry"
    />
  )
}
