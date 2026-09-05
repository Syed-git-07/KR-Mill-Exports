import PreparatoryEntrySidebar from '@/components/layout/PreparatoryEntrySidebar'
import EntryGridKeyboardNavigation from '@/components/ui/entry-grid-keyboard-navigation'

export const metadata = {
  title: 'Preparatory Entry - KR Production System',
  description: 'Preparatory process production entry',
}

export default function PreparatoryEntryLayout({ children }) {
  return (
    <div className="flex h-[calc(100dvh-3rem)] bg-gray-50">
      <EntryGridKeyboardNavigation />
      <PreparatoryEntrySidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
