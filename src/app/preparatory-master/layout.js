import MasterAccessNotice from '@/components/modules/masters/MasterAccessNotice'

export default function PreparatoryMastersLayout({ children }) {
  return (
    <>
      <MasterAccessNotice />
      {children}
    </>
  )
}
