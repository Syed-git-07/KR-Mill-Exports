import MasterSidebar from '@/components/layout/MasterSidebar'

export default function MastersLayout({ children }) {
  return (
    <div className="flex h-[calc(100dvh-3rem)]">
      <MasterSidebar />
      <div className="flex-1 overflow-auto bg-gray-50">
        {children}
      </div>
    </div>
  )
}
