import MasterAccessNotice from '@/components/modules/masters/MasterAccessNotice'

export default function MastersLayout({ children }) {
  return (
    <>
      <MasterAccessNotice />
      {children}
    </>
  )
}
