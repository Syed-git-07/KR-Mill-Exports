import { prisma } from '../prisma'

/**
 * Generate Spinning Stoppage Percentage Report
 * Shows stopped spindles and percentages grouped by stoppage categories
 * 
 * Correct Formula (as per spinning_count-formula.md):
 * - No of Spindles = (Allocated/8) × 8.5 (Shift 1&2) or × 7 (Shift 3)
 * - Spl = (Stoppage Mins / 510) × No of Spindles
 * - % = (Spl / No of Spindles) × 100
 * - Fixed shift time: 510 minutes
 * 
 * @param {Date} selectedDate - Normalized UTC date object
 */
export async function generateSpinningStoppageReport(selectedDate, selectedToDate = selectedDate) {
  try {
    // Date is already normalized from the action
    const date = selectedDate
    const toDate = selectedToDate

    // Get all production headers for the date across all shifts
    const headers = await prisma.spinning_production_header.findMany({
      where: {
        entry_date: { gte: date, lte: toDate },
      },
    })

    if (!headers || headers.length === 0) {
      return {
        success: false,
        message: 'No production data found for the selected date',
      }
    }

    // Get all production details for these headers
    const headerIds = headers.map(h => h.id)
    const details = await prisma.spinning_production_detail.findMany({
      where: {
        header_id: {
          in: headerIds
        }
      }
    })

    if (details.length === 0) {
      return {
        success: false,
        message: 'No production details found for the selected date',
      }
    }

    // Get all stoppage entries for these details
    const detailIds = details.map(d => d.id)
    const stoppageEntries = await prisma.spinning_stoppage_entry.findMany({
      where: {
        production_detail_id: {
          in: detailIds
        }
      }
    })

    // Get all machines
    const machineIds = details.map(d => d.machine_id)
    const machines = await prisma.spinning_machines.findMany({
      where: {
        id: {
          in: machineIds
        }
      }
    })

    const setups = await prisma.spinning_machine_setup.findMany({
      where: {
        entry_date: { gte: date, lte: toDate },
        machine_id: { in: machineIds }
      },
      select: {
        machine_id: true,
        entry_date: true,
        shift: true,
        run_sequence: true,
        allocated_spindles: true
      }
    })

    // Create lookup maps
    const headerMap = {}
    headers.forEach(h => {
      headerMap[h.id] = h
    })

    const detailMap = {}
    details.forEach(d => {
      detailMap[d.id] = d
    })

    const machineMap = {}
    machines.forEach(m => {
      machineMap[m.id] = m
    })
    const setupMap = new Map(setups.map(setup => [
      `${setup.entry_date.toISOString().slice(0, 10)}:${setup.shift}:${setup.machine_id}:${setup.run_sequence}`,
      setup
    ]))

    // Get stoppage heads and details for grouping
    const stoppageHeads = await prisma.stoppage_heads.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        code: 'asc',
      },
    })

    // Get all stoppage details separately
    const allStoppageDetails = await prisma.stoppage_details.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        code: 'asc',
      },
    })

    // Structure to hold stoppage data by category
    const stoppageData = {}

    // Initialize structure for each stoppage head
    stoppageHeads.forEach((head) => {
      stoppageData[head.id] = {
        headName: head.stoppage_head_name,
        code: head.code,
        details: {},
        shifts: {
          1: { stoppedSpindles: 0, percentage: 0 },
          2: { stoppedSpindles: 0, percentage: 0 },
          3: { stoppedSpindles: 0, percentage: 0 },
          total: { stoppedSpindles: 0, percentage: 0 },
        },
      }

      // Initialize each detail under this head
      const headDetails = allStoppageDetails.filter(d => d.stoppage_head_id === head.id)
      headDetails.forEach((detail) => {
        stoppageData[head.id].details[detail.id] = {
          detailName: detail.stoppage_name,
          fullName: detail.full_stoppage_name || detail.stoppage_name,
          code: detail.code,
          shifts: {
            1: { stoppedSpindles: 0, percentage: 0 },
            2: { stoppedSpindles: 0, percentage: 0 },
            3: { stoppedSpindles: 0, percentage: 0 },
            total: { stoppedSpindles: 0, percentage: 0 },
          },
        }
      })
    })

    // Calculate total No of Spindles per shift
    const totalNoOfSpindlesPerShift = {
      1: 0,
      2: 0,
      3: 0,
    }

    // Fixed shift time (as per specification)
    // Process each header and calculate stoppage data
    headers.forEach((header) => {
      const shift = header.shift

      // Get all details for this header
      const headerDetails = details.filter(d => d.header_id === header.id)

      headerDetails.forEach((detail) => {
        const machine = machineMap[detail.machine_id]
        
        if (!machine) return

        const entryDateKey = header.entry_date.toISOString().slice(0, 10)
        const setup = setupMap.get(`${entryDateKey}:${shift}:${machine.id}:${detail.run_sequence || 1}`)
        const allocatedSpindles = setup?.allocated_spindles ?? machine.allocated_spindles ?? 1104

        // CALCULATE No of Spindles based on shift (as per formula)
        const noOfSpindles =
          shift === 3
            ? (allocatedSpindles / 8) * 7
            : (allocatedSpindles / 8) * 8.5

        // Count-run rows share one shift. Prorating the entry snapshot by its
        // stored run time prevents a split run from duplicating the denominator.
        const shiftTime = shift === 3 ? 420 : 510
        const runTime = Math.min(Math.max(Number(detail.run_time ?? shiftTime) || 0, 0), shiftTime)
        totalNoOfSpindlesPerShift[shift] += noOfSpindles * (runTime / shiftTime)

        // The denominator includes every working machine, even when that
        // machine has no stoppage-entry row for the selected period.
        const stoppageEntry = stoppageEntries.find(s => s.production_detail_id === detail.id)
        if (!stoppageEntry) return

        // Process each stoppage (stoppage1 to stoppage4)
        const stoppages = [
          { id: stoppageEntry.stoppage1_id, time: stoppageEntry.stoppage1_time },
          { id: stoppageEntry.stoppage2_id, time: stoppageEntry.stoppage2_time },
          { id: stoppageEntry.stoppage3_id, time: stoppageEntry.stoppage3_time },
          { id: stoppageEntry.stoppage4_id, time: stoppageEntry.stoppage4_time },
        ]

        stoppages.forEach((stoppage) => {
          if (!stoppage.id || stoppage.time <= 0) return

          // Find which head this stoppage belongs to
          let foundHead = null
          let foundDetail = null

          Object.keys(stoppageData).forEach((headId) => {
            if (stoppageData[headId].details[stoppage.id]) {
              foundHead = headId
              foundDetail = stoppage.id
            }
          })

          if (!foundHead || !foundDetail) return

          // CORRECT FORMULA: Spl = (Stoppage Mins / 510) × No of Spindles
          const stoppedSpindles = (stoppage.time / shiftTime) * noOfSpindles

          // Add to detail level
          stoppageData[foundHead].details[foundDetail].shifts[shift].stoppedSpindles +=
            stoppedSpindles

          // Add to head level (will recalculate from details)
          // Note: Head totals are now sum of detail totals
        })
      })
    })

    // Calculate percentages and totals
    Object.keys(stoppageData).forEach((headId) => {
      const head = stoppageData[headId]

      // First, calculate for each detail
      Object.keys(head.details).forEach((detailId) => {
        const detail = head.details[detailId]

        // Calculate percentage for each shift: % = (Spl / No of Spindles) × 100
        ;[1, 2, 3].forEach((shift) => {
          if (totalNoOfSpindlesPerShift[shift] > 0) {
            detail.shifts[shift].percentage =
              (detail.shifts[shift].stoppedSpindles / totalNoOfSpindlesPerShift[shift]) * 100
          }
          detail.shifts.total.stoppedSpindles += detail.shifts[shift].stoppedSpindles
        })

        // Total percentage across all shifts
        const totalNoOfSpindles =
          totalNoOfSpindlesPerShift[1] + totalNoOfSpindlesPerShift[2] + totalNoOfSpindlesPerShift[3]
        if (totalNoOfSpindles > 0) {
          detail.shifts.total.percentage =
            (detail.shifts.total.stoppedSpindles / totalNoOfSpindles) * 100
        }
      })

      // Now calculate head totals by summing all detail values
      Object.keys(head.details).forEach((detailId) => {
        const detail = head.details[detailId]
        
        ;[1, 2, 3].forEach((shift) => {
          head.shifts[shift].stoppedSpindles += detail.shifts[shift].stoppedSpindles
        })
        head.shifts.total.stoppedSpindles += detail.shifts.total.stoppedSpindles
      })

      // Calculate head percentages
      ;[1, 2, 3].forEach((shift) => {
        if (totalNoOfSpindlesPerShift[shift] > 0) {
          head.shifts[shift].percentage =
            (head.shifts[shift].stoppedSpindles / totalNoOfSpindlesPerShift[shift]) * 100
        }
      })

      const totalNoOfSpindles =
        totalNoOfSpindlesPerShift[1] + totalNoOfSpindlesPerShift[2] + totalNoOfSpindlesPerShift[3]
      if (totalNoOfSpindles > 0) {
        head.shifts.total.percentage =
          (head.shifts.total.stoppedSpindles / totalNoOfSpindles) * 100
      }
    })

    // Calculate grand totals
    const grandTotal = {
      shifts: {
        1: { stoppedSpindles: 0, percentage: 0 },
        2: { stoppedSpindles: 0, percentage: 0 },
        3: { stoppedSpindles: 0, percentage: 0 },
        total: { stoppedSpindles: 0, percentage: 0 },
      },
    }

    Object.keys(stoppageData).forEach((headId) => {
      ;[1, 2, 3].forEach((shift) => {
        grandTotal.shifts[shift].stoppedSpindles +=
          stoppageData[headId].shifts[shift].stoppedSpindles
      })
      grandTotal.shifts.total.stoppedSpindles +=
        stoppageData[headId].shifts.total.stoppedSpindles
    })

    // Calculate grand total percentages
    ;[1, 2, 3].forEach((shift) => {
      if (totalNoOfSpindlesPerShift[shift] > 0) {
        grandTotal.shifts[shift].percentage =
          (grandTotal.shifts[shift].stoppedSpindles / totalNoOfSpindlesPerShift[shift]) * 100
      }
    })

    const totalNoOfSpindles =
      totalNoOfSpindlesPerShift[1] + totalNoOfSpindlesPerShift[2] + totalNoOfSpindlesPerShift[3]
    if (totalNoOfSpindles > 0) {
      grandTotal.shifts.total.percentage =
        (grandTotal.shifts.total.stoppedSpindles / totalNoOfSpindles) * 100
    }

    // Convert to array and sort by code
    const reportData = Object.keys(stoppageData)
      .map((headId) => ({
        headId,
        ...stoppageData[headId],
        details: Object.keys(stoppageData[headId].details)
          .map((detailId) => ({
            detailId,
            ...stoppageData[headId].details[detailId],
          }))
          .filter((d) => d.shifts.total.stoppedSpindles > 0) // Only show details with data
          .sort((a, b) => a.code - b.code),
      }))
      .filter((h) => h.shifts.total.stoppedSpindles > 0) // Only show heads with data
      .sort((a, b) => a.code - b.code)

    return {
      success: true,
      date: selectedDate,
      toDate: selectedToDate,
      reportData,
      grandTotal,
      totalNoOfSpindlesPerShift,
    }
  } catch (error) {
    console.error('Error generating spinning stoppage report:', error)
    return {
      success: false,
      message: 'The report could not be generated. Please try again.',
    }
  }
}
