'use server'

const { getAutoconerAbstractReport } = require('./autoconerAbstractReportQueries')

export async function fetchAutoconerAbstractReport(date) {
  return await getAutoconerAbstractReport(date)
}
