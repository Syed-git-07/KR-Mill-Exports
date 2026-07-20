const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// RESOLVE CARDING FORMULA
function calculateCardingStdProdn(setup, shiftTime) {
  const speed = Number(setup.speed ?? 130);
  const hank = Number(setup.hank_constant ?? 0.1300);
  const effi = Number(setup.std_efficiency_factor ?? 0.9800);
  const divisor = Number(setup.divisor_constant ?? 1693);
  return (speed / divisor / hank) * shiftTime * effi;
}

// CENTRALIZED FALLBACK TIME
function resolveCardingShiftFallbackTime(shift) {
  return shift === 3 ? 420 : 510;
}

// REPLICATED LOGIC FROM cardingEntryQueries.js
async function getCardingShiftTime(shift) {
  const config = await prisma.shift_config.findFirst({
    where: {
      department_code: 'CARDING',
      shift: shift,
      is_active: true
    }
  });
  return config?.shift_time || resolveCardingShiftFallbackTime(shift);
}

async function getOrCreateCardingMachineSetups(entryDate, shift = 1) {
  try {
    const dateObj = new Date(entryDate)
    const shiftNum = parseInt(shift)
    const targetShiftTime = await getCardingShiftTime(shiftNum)
    
    // 1. Try to find setups for this exact date and shift
    let setups = await prisma.carding_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
      }
    })
    
    if (setups.length > 0) {
      return setups
    }
    
    // 2. Fallback: Inherit from the most recent chronologically prior setups in the database
    const latestPreviousSetup = await prisma.carding_machine_setup.findFirst({
      where: {
        OR: [
          { entry_date: { lt: dateObj } },
          {
            entry_date: dateObj,
            shift: { lt: shiftNum }
          }
        ]
      },
      orderBy: [
        { entry_date: 'desc' },
        { shift: 'desc' }
      ]
    })
    
    if (latestPreviousSetup) {
      const prevSetups = await prisma.carding_machine_setup.findMany({
        where: { 
          entry_date: latestPreviousSetup.entry_date,
          shift: latestPreviousSetup.shift
        }
      })
      
      const prevMachineIds = prevSetups.map(s => s.machine_id)

      // Find active machines that are missing setups in the prior record set
      const activeMachines = await prisma.carding_machines.findMany({
        where: { is_active: true }
      })
      const missingMachines = activeMachines.filter(m => !prevMachineIds.includes(m.id))

      const cloneData = prevSetups.map(s => {
        const { id, created_at, updated_at, ...rest } = s
        const fallbackStdProdn = calculateCardingStdProdn({
          speed: rest.speed,
          divisor_constant: rest.divisor_constant ?? 1693,
          hank_constant: rest.hank_constant,
          std_efficiency_factor: rest.std_efficiency_factor
        }, targetShiftTime)

        return {
          ...rest,
          entry_date: dateObj,
          shift: shiftNum,
          shift_time: targetShiftTime,
          std_prodn: Math.round(fallbackStdProdn * 100) / 100
        }
      })

      const missingSetups = missingMachines.map(m => {
        const rawEffi = Number(m.prodn_efficiency ?? 0.9800)
        const stdEffi = rawEffi > 1 ? rawEffi / 100 : rawEffi

        const fallbackStdProdn = calculateCardingStdProdn({
          speed: m.speed ?? 130,
          divisor_constant: 1693,
          hank_constant: m.hank_constant ?? 0.1300,
          std_efficiency_factor: stdEffi
        }, targetShiftTime)
        
        return {
          machine_id: m.id,
          entry_date: dateObj,
          shift: shiftNum,
          speed: m.speed ?? 130.00,
          hank_constant: m.hank_constant ?? 0.1300,
          std_efficiency_factor: stdEffi,
          default_waste: 0.3400,
          std_prodn: Math.round(fallbackStdProdn * 100) / 100,
          shift_time: targetShiftTime,
          default_stoppage: 0,
          divisor_constant: 1693
        }
      })

      const allDataToInsert = [...cloneData, ...missingSetups]
      
      if (allDataToInsert.length > 0) {
        await prisma.carding_machine_setup.createMany({
          data: allDataToInsert
        })
      }
      
      return await prisma.carding_machine_setup.findMany({
        where: { 
          entry_date: dateObj,
          shift: shiftNum
        }
      })
    }
    
    // 3. Fallback: Initialize default setups for all active machines
    const activeMachines = await prisma.carding_machines.findMany({
      where: { is_active: true }
    })
    
    const defaultSetups = activeMachines.map(m => {
      const rawEffi = Number(m.prodn_efficiency ?? 0.9800)
      const stdEffi = rawEffi > 1 ? rawEffi / 100 : rawEffi

      const fallbackStdProdn = calculateCardingStdProdn({
        speed: m.speed ?? 130,
        divisor_constant: 1693,
        hank_constant: m.hank_constant ?? 0.1300,
        std_efficiency_factor: stdEffi
      }, targetShiftTime)
      
      return {
        machine_id: m.id,
        entry_date: dateObj,
        shift: shiftNum,
        speed: m.speed ?? 130.00,
        hank_constant: m.hank_constant ?? 0.1300,
        std_efficiency_factor: stdEffi,
        default_waste: 0.3400,
        std_prodn: Math.round(fallbackStdProdn * 100) / 100,
        shift_time: targetShiftTime,
        default_stoppage: 0,
        divisor_constant: 1693
      }
    })
    
    if (defaultSetups.length > 0) {
      await prisma.carding_machine_setup.createMany({
        data: defaultSetups
      })
    }
    
    return await prisma.carding_machine_setup.findMany({
      where: { 
        entry_date: dateObj,
        shift: shiftNum
      }
    })
  } catch (error) {
    throw error
  }
}

async function updateMachineSetup(identifier, updates, entryDate = null, shift = null) {
  try {
    let existing = null

    // 1. Try to find unique row by setup UUID
    if (identifier && identifier.length === 36) {
      existing = await prisma.carding_machine_setup.findUnique({
        where: { id: identifier },
        select: { id: true, machine_id: true, entry_date: true, shift: true }
      })
    }

    // 2. If not found by unique ID, try by machine_id + entryDate + shift
    if (!existing && entryDate && shift) {
      existing = await prisma.carding_machine_setup.findFirst({
        where: { 
          machine_id: identifier,
          entry_date: new Date(entryDate),
          shift: parseInt(shift)
        },
        select: { id: true, machine_id: true, entry_date: true, shift: true }
      })
    }

    // 3. Backward fallback to first setup record
    if (!existing) {
      existing = await prisma.carding_machine_setup.findFirst({
        where: { machine_id: identifier },
        select: { id: true, machine_id: true, entry_date: true, shift: true }
      })
    }

    if (!existing?.id) {
      throw new Error(`Machine setup not found for identifier ${identifier}`)
    }

    const currentSetup = await prisma.carding_machine_setup.findUnique({
      where: { id: existing.id },
      select: {
        speed: true,
        hank_constant: true,
        std_efficiency_factor: true,
        divisor_constant: true,
        shift_time: true
      }
    })

    const mergedSetup = {
      ...currentSetup,
      ...updates
    }

    const shiftTime = Number(mergedSetup.shift_time || 0)
    if (shiftTime > 0) {
      const recalculatedStdProdn = calculateCardingStdProdn(mergedSetup, shiftTime)
      updates.std_prodn = Math.round(recalculatedStdProdn * 100) / 100
    }

    const data = await prisma.carding_machine_setup.update({
      where: { id: existing.id },
      data: updates
    })
    return data
  } catch (error) {
    throw error
  }
}

// Helper to fetch inherited machine setups from the chronologically prior shift/date's production details
async function getCardingInheritedMachineSetups(dateObj, shiftNum, headerId) {
  try {
    const d = new Date(dateObj)
    const s = parseInt(shiftNum)

    // Find the most recent chronologically entered header prior to (d, s)
    const priorHeader = await prisma.carding_production_header.findFirst({
      where: {
        id: { not: headerId },
        OR: [
          { entry_date: { lt: d } },
          {
            entry_date: d,
            shift: { lt: s }
          }
        ]
      },
      orderBy: [
        { entry_date: 'desc' },
        { shift: 'desc' }
      ]
    })

    if (!priorHeader) {
      return {}
    }

    // Fetch production details for this prior header
    const details = await prisma.carding_production_detail.findMany({
      where: { header_id: priorHeader.id },
      select: {
        machine_id: true,
        count_mixing: true,
        employee_name: true,
        session_no: true
      }
    })

    // Convert to map: machine_id -> { count_mixing, employee_name, session_no }
    const inheritedMap = {}
    details.forEach(detail => {
      inheritedMap[detail.machine_id] = {
        count_mixing: detail.count_mixing,
        employee_name: detail.employee_name,
        session_no: detail.session_no
      }
    })

    return inheritedMap
  } catch (error) {
    console.error('Error in getCardingInheritedMachineSetups:', error)
    return {}
  }
}

// Initialize production details for all carding machines visible on the entry date
async function initializeProductionDetails(headerId, shift = 1) {
  try {
    // Get entry_date from the header
    const header = await prisma.carding_production_header.findUnique({
      where: { id: headerId },
      select: { entry_date: true }
    })
    const entryDate = header?.entry_date || new Date()

    // Check if details already exist for this header
    const existingDetails = await prisma.carding_production_detail.findMany({
      where: { header_id: headerId },
      select: { machine_id: true }
    })

    const existingMachineIds = existingDetails?.map(d => d.machine_id) || []

    // Get setups scoped strictly by the entry date and shift
    const setups = await getOrCreateCardingMachineSetups(entryDate, shift)
    const machineIdsWithSetup = setups.map(s => s.machine_id)

    // Get all carding machines visible on the entry date that have a setup entry
    const machines = await prisma.carding_machines.findMany({
      where: {
        id: { in: machineIdsWithSetup },
        activated_at: { lte: entryDate },
        OR: [{ deactivated_at: null }, { deactivated_at: { gt: entryDate } }]
      },
      orderBy: { mc_id: 'asc' }
    })

    // Filter out machines that already have entries
    const newMachines = machines.filter(m => !existingMachineIds.includes(m.id))

    // If all machines already have entries, return early
    if (newMachines.length === 0) {
      return existingDetails
    }

    // Create a map of machine_id to setup
    const setupMap = {}
    setups?.forEach(s => {
      setupMap[s.machine_id] = s
    })

    // Fetch inherited machine setups from the chronologically prior shift/date's production details
    const inheritedSetups = await getCardingInheritedMachineSetups(entryDate, shift, headerId)

    // Get shift-specific runtime from configuration (DB-first + fallback)
    const totalTime = await getCardingShiftTime(shift)
    const defaultStoppage = 0
    const defaultWorkTime = totalTime - defaultStoppage
    const defaultUti = Math.round((defaultWorkTime / totalTime) * 100 * 100) / 100
    
    const details = newMachines.map(machine => {
      const setup = setupMap[machine.id] || {}
      const inherited = inheritedSetups[machine.id] || {}

      const countMixing = inherited.count_mixing !== undefined ? inherited.count_mixing : (machine.prodn_mixing || '64COMBED GOLD')
      const employeeName = inherited.employee_name !== undefined ? inherited.employee_name : null
      const sessionNo = inherited.session_no !== undefined ? inherited.session_no : 1

      const fallbackStdProdn = calculateCardingStdProdn(setup, totalTime)
      return {
        header_id: headerId,
        machine_id: machine.id,
        count_mixing: countMixing,
        employee_name: employeeName,
        act_hank: 0,
        act_prodn: 0,
        std_prodn: setup.std_prodn ?? fallbackStdProdn,
        exp_prodn: 0,
        effi_percent: 0,
        uti_percent: defaultUti,
        waste: setup.default_waste ?? null,
        waste_percent: 0,
        run_time: totalTime,
        work_time: defaultWorkTime,
        total_stoppage_mins: defaultStoppage,
        session_no: sessionNo
      }
    })

    await prisma.carding_production_detail.createMany({
      data: details
    })

    return await prisma.carding_production_detail.findMany({
      where: { header_id: headerId }
    })
  } catch (error) {
    throw error
  }
}

async function cleanDataForDate(dateStr) {
  const d = new Date(dateStr);
  const headers = await prisma.carding_production_header.findMany({
    where: { entry_date: d }
  });
  
  for (const h of headers) {
    const details = await prisma.carding_production_detail.findMany({
      where: { header_id: h.id }
    });
    const detailIds = details.map(x => x.id);
    if (detailIds.length > 0) {
      await prisma.carding_stoppage_entry.deleteMany({
        where: { production_detail_id: { in: detailIds } }
      });
      await prisma.carding_production_detail.deleteMany({
        where: { header_id: h.id }
      });
    }
  }
  
  await prisma.carding_production_header.deleteMany({
    where: { entry_date: d }
  });

  await prisma.carding_machine_setup.deleteMany({
    where: { entry_date: d }
  });
}

async function runTests() {
  console.log('--- STARTING CARDING STRICT SETUP ISOLATION INTEGRATION TESTS ---');

  const dateD1 = '2026-07-10'; // Past/Current Date
  const dateD2 = '2026-07-11'; // Future Date

  console.log('Cleaning up existing test data...');
  await cleanDataForDate(dateD1);
  await cleanDataForDate(dateD2);

  // Get active machines to use for validation
  const machines = await prisma.carding_machines.findMany({
    where: { is_active: true },
    take: 1
  });

  if (machines.length === 0) {
    console.error('No active carding machines found in database to run tests!');
    process.exit(1);
  }

  const testMachineId = machines[0].id;
  const testMachineNo = machines[0].machine_no;
  console.log(`Using Machine: ${testMachineNo} (ID: ${testMachineId}) for isolation verification.`);

  try {
    // ----------------------------------------------------------------------
    // TEST 1: Strict Date & Shift Setup Scoping Isolation
    // ----------------------------------------------------------------------
    console.log('\nCreating initial setups for both dates and shifts...');
    
    // Date D1 Shift 1
    const setupsD1S1 = await getOrCreateCardingMachineSetups(dateD1, 1);
    const setupD1S1 = setupsD1S1.find(s => s.machine_id === testMachineId);
    
    // Date D2 Shift 1
    const setupsD2S1 = await getOrCreateCardingMachineSetups(dateD2, 1);
    const setupD2S1 = setupsD2S1.find(s => s.machine_id === testMachineId);

    console.log(`Initial Setup Speed:`);
    console.log(`- Date D1 Shift 1 Speed: ${setupD1S1.speed}`);
    console.log(`- Date D2 Shift 1 Speed: ${setupD2S1.speed}`);

    console.log(`\n--- TEST 1: Modifying Setup for Date D1 (${dateD1}) Shift 1 Speed to 150 ---`);
    await updateMachineSetup(setupD1S1.id, { speed: 150 }, dateD1, 1);

    // Reload all records to verify state
    const reloadedSetupD1S1 = await prisma.carding_machine_setup.findUnique({ where: { id: setupD1S1.id } });
    const reloadedSetupD2S1 = await prisma.carding_machine_setup.findUnique({ where: { id: setupD2S1.id } });

    console.log(`Reloaded Speeds:`);
    console.log(`- Date D1 Shift 1 Speed: ${reloadedSetupD1S1.speed} (expected: 150)`);
    console.log(`- Date D2 Shift 1 Speed: ${reloadedSetupD2S1.speed} (expected: 130 or master default)`);

    if (Number(reloadedSetupD1S1.speed) === 150) {
      console.log('SUCCESS: Date D1 Shift 1 record correctly modified.');
    } else {
      throw new Error('D1 S1 record not updated correctly!');
    }

    if (Number(reloadedSetupD2S1.speed) !== 150) {
      console.log('SUCCESS: Date D2 Shift 1 record remained completely isolated and untouched!');
    } else {
      throw new Error('Bleeding detected! D2 records were modified by D1 changes!');
    }

    // ----------------------------------------------------------------------
    // TEST 2: Chronological Shift-to-Shift Inheritance cloning
    // ----------------------------------------------------------------------
    console.log(`\n--- TEST 2: Verify Shift 2 setup inherits count/speed from Shift 1 ---`);
    const setupsD1S2 = await getOrCreateCardingMachineSetups(dateD1, 2);
    const setupD1S2 = setupsD1S2.find(s => s.machine_id === testMachineId);

    console.log(`Inherited Values for D1 Shift 2:`);
    console.log(`- Speed: ${setupD1S2.speed} (expected: 150)`);
    console.log(`- Shift Time: ${setupD1S2.shift_time} (expected: 510)`);

    if (Number(setupD1S2.speed) === 150) {
      console.log('SUCCESS: Chronological shift-to-shift inheritance cloned correctly!');
    } else {
      throw new Error('Cloning failed! Shift 2 did not inherit Shift 1 setup.');
    }

    console.log(`\n--- TEST 3: Verify Shift 3 inherits with Shift-specific total runtime (420 mins) ---`);
    const setupsD1S3 = await getOrCreateCardingMachineSetups(dateD1, 3);
    const setupD1S3 = setupsD1S3.find(s => s.machine_id === testMachineId);

    console.log(`Inherited Values for D1 Shift 3:`);
    console.log(`- Speed: ${setupD1S3.speed} (expected: 150)`);
    console.log(`- Shift Time: ${setupD1S3.shift_time} (expected: 420)`);

    if (Number(setupD1S3.speed) === 150 && setupD1S3.shift_time === 420) {
      console.log('SUCCESS: Chronological Shift 3 inheritance and dynamic runtime override verified!');
    } else {
      throw new Error('Shift 3 dynamic runtime override or inheritance failed!');
    }

    // ----------------------------------------------------------------------
    // TEST 4: Chronological Shift-to-Shift Production Details Cloning (modify-14.md)
    // ----------------------------------------------------------------------
    console.log(`\n--- TEST 4: Verify Shift 2 production detail inherits count_mixing & employee_name from Shift 1 production detail ---`);
    
    // Create production header for Date D1 Shift 1
    const headerD1S1 = await prisma.carding_production_header.create({
      data: { entry_date: new Date(dateD1), shift: 1, total_time: 510 }
    });

    // Initialize production details for Shift 1
    const detailsD1S1 = await initializeProductionDetails(headerD1S1.id, 1);
    const detailD1S1 = detailsD1S1.find(d => d.machine_id === testMachineId);

    // Modify Shift 1 production details to simulate user entry
    const modifiedDetailD1S1 = await prisma.carding_production_detail.update({
      where: { id: detailD1S1.id },
      data: {
        count_mixing: 'TEST COUNT 40s',
        employee_name: 'Akhil'
      }
    });

    // Create production header for Date D1 Shift 2
    const headerD1S2 = await prisma.carding_production_header.create({
      data: { entry_date: new Date(dateD1), shift: 2, total_time: 510 }
    });

    // Initialize production details for Shift 2 (which should inherit from Shift 1 details!)
    const detailsD1S2 = await initializeProductionDetails(headerD1S2.id, 2);
    const detailD1S2 = detailsD1S2.find(d => d.machine_id === testMachineId);

    console.log(`Shift 2 Cloned Production Details:`);
    console.log(`- Count Mixing: '${detailD1S2.count_mixing}' (expected: 'TEST COUNT 40s')`);
    console.log(`- Employee Name: '${detailD1S2.employee_name}' (expected: 'Akhil')`);

    if (detailD1S2.count_mixing === 'TEST COUNT 40s' && detailD1S2.employee_name === 'Akhil') {
      console.log('SUCCESS: Shift-to-Shift production details inheritance cloning verified successfully!');
    } else {
      throw new Error('Shift-to-Shift production details inheritance cloning failed!');
    }

    console.log('\n--- ALL STRICT CARDING ISOLATION AND CLONING INTEGRATION TESTS PASSED SUCCESSFULLY! ---');

  } catch (error) {
    console.error('TESTING ERROR:', error);
    process.exit(1);
  } finally {
    console.log('\nCleaning up test data...');
    await cleanDataForDate(dateD1);
    await cleanDataForDate(dateD2);
    
    await prisma.$disconnect();
    console.log('Disconnected Prisma Client.');
  }
}

runTests();
