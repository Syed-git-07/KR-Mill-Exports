import { notFound } from 'next/navigation'
import { getFinalReportConfig } from '@/lib/reports/finalReportCatalog'
import FinalReportClient from './report-client'

export default async function FinalReportPage({ params }) {
  const { reportKey } = await params
  const config = getFinalReportConfig(reportKey)
  if (!config) notFound()
  return <FinalReportClient reportKey={reportKey} config={config} />
}
