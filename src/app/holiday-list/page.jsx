import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import HolidayListManagement from '@/components/modules/post-preparatory/HolidayListManagement'

export const metadata = { title: 'Holiday List - KR Production System' }

export default function HolidayListPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 pt-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
      </div>
      <HolidayListManagement />
    </div>
  )
}
