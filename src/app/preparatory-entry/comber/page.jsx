'use client'

import DateShiftListPage from '@/components/modules/common/DateShiftListPage'

export default function ComberDateListPage() {
  return (
    <DateShiftListPage
      moduleName="Comber Entry"
      tableName="comber_production_header"
      entryPath="/preparatory-entry/comber/entry"
    />
  )
}
