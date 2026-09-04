'use client'

import EnterSelect from '@/components/ui/enter-select'

/** Entry-only searchable selector that presents its options in a modal. */
export default function EntrySelect({
  dialogTitle = 'Select count / mixing',
  ...props
}) {
  return (
    <EnterSelect
      {...props}
      searchable
      dialogMode
      dialogTitle={dialogTitle}
    />
  )
}
