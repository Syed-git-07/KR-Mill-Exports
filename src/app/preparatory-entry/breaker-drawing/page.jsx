'use client'

import DateShiftListPage from '@/components/modules/common/DateShiftListPage'

export default function BreakerDrawingDateListPage() {
  return (
    <DateShiftListPage
      moduleName="Breaker Drawing Machine"
      tableName="breaker_drawing_production_header"
      entryPath="/preparatory-entry/breaker-drawing/entry"
    />
  )
}
