'use client'

import DateShiftListPage from '@/components/modules/common/DateShiftListPage'

export default function FinisherDrawingDateListPage() {
  return (
    <DateShiftListPage
      moduleName="Finisher Drawing"
      tableName="finisher_drawing_production_header"
      entryPath="/preparatory-entry/finisher-drawing/entry"
    />
  )
}
