'use client'

import DateShiftListPage from '@/components/modules/common/DateShiftListPage'

export default function LapFormerDateListPage() {
  return (
    <DateShiftListPage
      moduleName="Lap Former"
      tableName="lap_former_production_header"
      entryPath="/preparatory-entry/lap-former/entry"
    />
  )
}
