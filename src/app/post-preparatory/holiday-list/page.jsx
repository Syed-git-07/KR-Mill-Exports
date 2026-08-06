import { redirect } from 'next/navigation'
import { withBasePath } from '@/lib/app-path'

export default function HolidayListPage() {
  redirect(withBasePath('/holiday-list'))
}
