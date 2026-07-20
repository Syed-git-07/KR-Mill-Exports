import { prisma } from '../prisma'

/**
 * Department configurations for waste report
 */
const DEPARTMENTS = {
  CARDING: { code: 'CARDING', name: 'CARDING', table: 'carding', section: 'preparatory', wasteField: 'waste' },
  BREAKER: { code: 'BREAKER', name: 'BREAKER DRAWING', table: 'breaker_drawing', section: 'preparatory', wasteField: 'waste' },
  LAPFORMER: { code: 'LAPFORMER', name: 'LAP FORMER', table: 'lap_former', section: 'preparatory', wasteField: 'waste' },
  COMBER: { code: 'COMBER', name: 'COMBER', table: 'comber', section: 'preparatory', wasteField: 'waste' },
  FINISHER: { code: 'FINISHER', name: 'FINISHER DRAWING', table: 'finisher_drawing', section: 'preparatory', wasteField: 'waste' },
  SIMPLEX: { code: 'SIMPLEX', name: 'SIMPLEX', table: 'simplex', section: 'preparatory', wasteField: 'waste' },
  SPINNING: { code: 'SPINNING', name: 'SPINNING', table: 'spinning', section: 'post-preparatory', wasteField: 'waste' },
  AUTOCONER: { code: 'AUTOCONER', name: 'AUTO CONER', table: 'autoconer', section: 'post-preparatory', wasteField: 'waste_kg' }
}

/**
 * Get waste data for a single department for a specific date range
 */
async function getDepartmentWasteData(departmentCode, fromDate, toDate) {
  const dept = Object.values(DEPARTMENTS).find(d => d.code === departmentCode)
  if (!dept) throw new Error(`Invalid department: ${departmentCode}`)

  const tablePrefix = dept.table
  const wasteField = dept.wasteField

  // Query production headers within date range
  const headers = await prisma[`${tablePrefix}_production_header`].findMany({
    where: {
      entry_date: {
        gte: fromDate,
        lte: toDate
      }
    },
    select: {
      id: true,
      entry_date: true
    }
  })

  if (headers.length === 0) {
    return {
      totalWaste: 0,
      totalProduction: 0,
      wastePercent: 0
    }
  }

  const headerIds = headers.map(h => h.id)

  // Query production details for these headers
  const details = await prisma[`${tablePrefix}_production_detail`].findMany({
    where: {
      header_id: {
        in: headerIds
      }
    },
    select: {
      [wasteField]: true,
      act_prodn: true
    }
  })

  // Calculate totals
  let totalWaste = 0
  let totalProduction = 0

  details.forEach(detail => {
    const waste = parseFloat(detail[wasteField] || 0)
    const production = parseFloat(detail.act_prodn || 0)
    
    totalWaste += waste
    totalProduction += production
  })

  // Calculate waste percentage
  const wastePercent = totalProduction > 0 ? (totalWaste / totalProduction) * 100 : 0

  return {
    totalWaste: parseFloat(totalWaste.toFixed(4)),
    totalProduction: parseFloat(totalProduction.toFixed(2)),
    wastePercent: parseFloat(wastePercent.toFixed(2))
  }
}

/**
 * Get "Up to" date range (from start of month to day before selected date)
 */
function getUpToDateRange(selectedDate) {
  const date = new Date(selectedDate)
  
  // Start of month in UTC
  const startOfMonth = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1, 0, 0, 0))
  
  // Day before selected date in UTC
  const dayBefore = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() - 1, 23, 59, 59))
  
  return { from: startOfMonth, to: dayBefore }
}

/**
 * Generate Preparatory Waste Abstract Report
 */
export async function generatePreparatoryWasteReport(fromDate, toDate) {
  console.log('Generating Preparatory Waste Report...')
  console.log('  Period From:', fromDate.toISOString())
  console.log('  Period To:', toDate.toISOString())

  // Calculate "Up to" date range (from start of month to day before fromDate)
  const upToRange = getUpToDateRange(fromDate)
  console.log('  Up To Range:', upToRange.from.toISOString(), 'to', upToRange.to.toISOString())

  const reportData = {
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      uptoFrom: upToRange.from.toISOString(),
      uptoTo: upToRange.to.toISOString()
    },
    preparatory: [],
    postPreparatory: [],
    preparatoryTotal: {
      wasteKgsUpto: 0,
      wastePercentUpto: 0,
      wasteKgs: 0,
      wastePercent: 0
    },
    grandTotal: {
      wasteKgsUpto: 0,
      wastePercentUpto: 0,
      wasteKgs: 0,
      wastePercent: 0
    }
  }

  // Track totals for percentage calculations
  let prepTotalWasteUpto = 0
  let prepTotalProdUpto = 0
  let prepTotalWaste = 0
  let prepTotalProd = 0

  let grandTotalWasteUpto = 0
  let grandTotalProdUpto = 0
  let grandTotalWaste = 0
  let grandTotalProd = 0

  // Process all departments
  for (const dept of Object.values(DEPARTMENTS)) {
    console.log(`Processing ${dept.name}...`)

    // Get "Up to" data
    const uptoData = await getDepartmentWasteData(dept.code, upToRange.from, upToRange.to)
    
    // Get period data
    const periodData = await getDepartmentWasteData(dept.code, fromDate, toDate)

    const deptResult = {
      department: dept.name,
      wasteKgsUpto: uptoData.totalWaste,
      wastePercentUpto: uptoData.wastePercent,
      wasteKgs: periodData.totalWaste,
      wastePercent: periodData.wastePercent
    }

    // Add to appropriate section
    if (dept.section === 'preparatory') {
      reportData.preparatory.push(deptResult)
      prepTotalWasteUpto += uptoData.totalWaste
      prepTotalProdUpto += uptoData.totalProduction
      prepTotalWaste += periodData.totalWaste
      prepTotalProd += periodData.totalProduction
    } else {
      reportData.postPreparatory.push(deptResult)
    }

    // Add to grand totals
    grandTotalWasteUpto += uptoData.totalWaste
    grandTotalProdUpto += uptoData.totalProduction
    grandTotalWaste += periodData.totalWaste
    grandTotalProd += periodData.totalProduction
  }

  // Calculate preparatory totals
  reportData.preparatoryTotal = {
    wasteKgsUpto: parseFloat(prepTotalWasteUpto.toFixed(2)),
    wastePercentUpto: prepTotalProdUpto > 0 ? parseFloat(((prepTotalWasteUpto / prepTotalProdUpto) * 100).toFixed(2)) : 0,
    wasteKgs: parseFloat(prepTotalWaste.toFixed(2)),
    wastePercent: prepTotalProd > 0 ? parseFloat(((prepTotalWaste / prepTotalProd) * 100).toFixed(2)) : 0
  }

  // Calculate grand totals
  reportData.grandTotal = {
    wasteKgsUpto: parseFloat(grandTotalWasteUpto.toFixed(2)),
    wastePercentUpto: grandTotalProdUpto > 0 ? parseFloat(((grandTotalWasteUpto / grandTotalProdUpto) * 100).toFixed(2)) : 0,
    wasteKgs: parseFloat(grandTotalWaste.toFixed(2)),
    wastePercent: grandTotalProd > 0 ? parseFloat(((grandTotalWaste / grandTotalProd) * 100).toFixed(2)) : 0
  }

  console.log('Report generation complete!')
  return reportData
}
