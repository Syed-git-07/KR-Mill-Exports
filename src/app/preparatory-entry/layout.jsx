import PreparatoryEntrySidebar from '@/components/layout/PreparatoryEntrySidebar'

export const metadata = {
  title: 'Preparatory Entry - KR Production System',
  description: 'Preparatory process production entry',
}

export default function PreparatoryEntryLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <PreparatoryEntrySidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
