'use client'

import DateShiftListPage from '@/components/modules/common/DateShiftListPage'

export default function AutoconerDateListPage() {
  return (
    <DateShiftListPage
      moduleName="Autoconer"
      tableName="autoconer_production_header"
      entryPath="/post-preparatory/autoconer/entry"
    />
  )
}
