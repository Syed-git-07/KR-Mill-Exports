'use client'

import DateShiftListPage from '@/components/modules/common/DateShiftListPage'

export default function SpinningDateListPage() {
  return (
    <DateShiftListPage
      moduleName="Spinning"
      tableName="spinning_production_header"
      entryPath="/post-preparatory/spinning/entry"
    />
  )
}
