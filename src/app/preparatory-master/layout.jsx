import PreparatorySidebar from '@/components/layout/PreparatorySidebar'

export default function PreparatoryMasterLayout({ children }) {
  return (
    <div className="flex h-[calc(100vh-80px)]">
      <PreparatorySidebar />
      <div className="flex-1 overflow-auto bg-gray-50">
        {children}
      </div>
    </div>
  )
}
