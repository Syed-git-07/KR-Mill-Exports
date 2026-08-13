'use server'

import { requireUser } from '@/lib/security/auth'

const { getAutoconerAbstractReport } = require('./autoconerAbstractReportQueries')

export async function fetchAutoconerAbstractReport(date) {
  await requireUser()
  return await getAutoconerAbstractReport(date)
}
