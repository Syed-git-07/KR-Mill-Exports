import MasterSidebar from '@/components/layout/MasterSidebar'

export default function MastersLayout({ children }) {
  return (
    <div className="flex h-[calc(100vh-80px)]">
      <MasterSidebar />
      <div className="flex-1 overflow-auto bg-gray-50">
        {children}
      </div>
    </div>
  )
}
