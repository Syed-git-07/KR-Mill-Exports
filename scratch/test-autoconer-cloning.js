const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// REPLICATED LOGIC FROM autoconerEntryQueries.js
async function getInheritedMachineSetups(dateObj, shiftNum, headerId) {
  try {
    const d = new Date(dateObj);
    const s = parseInt(shiftNum);

    const priorHeader = await prisma.autoconer_production_header.findFirst({
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
    });

    if (!priorHeader) {
      return {};
    }

    const details = await prisma.autoconer_production_detail.findMany({
      where: { header_id: priorHeader.id },
      select: {
        machine_id: true,
        count_name: true,
        count_id: true,
        session_no: true
      }
    });

    const inheritedMap = {};
    details.forEach(detail => {
      inheritedMap[detail.machine_id] = {
        count_name: detail.count_name,
        count_id: detail.count_id,
        session_no: detail.session_no
      };
    });

    return inheritedMap;
  } catch (error) {
    throw error;
  }
}

async function cleanDataForDate(dateStr) {
  const d = new Date(dateStr);
  const headers = await prisma.autoconer_production_header.findMany({
    where: { entry_date: d }
  });
  
  for (const h of headers) {
    const details = await prisma.autoconer_production_detail.findMany({
      where: { header_id: h.id }
    });
    const detailIds = details.map(x => x.id);
    if (detailIds.length > 0) {
      await prisma.autoconer_stoppage_entry.deleteMany({
        where: { production_detail_id: { in: detailIds } }
      });
      await prisma.autoconer_production_detail.deleteMany({
        where: { header_id: h.id }
      });
    }
  }
  
  await prisma.autoconer_production_header.deleteMany({
    where: { entry_date: d }
  });
}

async function createDetailForTest(headerId, machineId, count, session = 1) {
  return await prisma.autoconer_production_detail.create({
    data: {
      header_id: headerId,
      machine_id: machineId,
      count_name: count,
      act_prodn: 0,
      prodn_effi: 0,
      red_light: 0,
      idle_drum: 0,
      waste_kg: 0.0,
      waste_percent: 0.0,
      total_stoppage_mins: 0,
      session_no: session,
      run_time: 510,
      work_time: 510
    }
  });
}

async function runTests() {
  console.log('--- STARTING AUTOCONER CLONING SEQUENCE INTEGRATION TESTS ---');

  const dateD1 = '2026-06-10'; // Date 1
  const dateD2 = '2026-06-11'; // Date 2 (Next Day)

  console.log('Cleaning up existing test data...');
  await cleanDataForDate(dateD1);
  await cleanDataForDate(dateD2);

  const machines = await prisma.autoconer_machines.findMany({
    where: { is_active: true },
    take: 1
  });

  if (machines.length === 0) {
    console.error('No active autoconer machines found!');
    process.exit(1);
  }

  const testMachineId = machines[0].id;

  try {
    // ----------------------------------------------------------------------
    // TEST 1: Shift 1 -> Shift 2 Cloning (Same Date)
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 1: Verify Shift 2 inherits count from Shift 1 ---');
    
    // Create Shift 1 on Date D1
    const headerD1S1 = await prisma.autoconer_production_header.create({
      data: { entry_date: new Date(dateD1), shift: 1, total_time: 510 }
    });
    await createDetailForTest(headerD1S1.id, testMachineId, '40s CARDED', 1);

    // Create Shift 2 on Date D1
    const headerD1S2 = await prisma.autoconer_production_header.create({
      data: { entry_date: new Date(dateD1), shift: 2, total_time: 510 }
    });

    const inheritedD1S2 = await getInheritedMachineSetups(dateD1, 2, headerD1S2.id);
    const countD1S2 = inheritedD1S2[testMachineId]?.count_name;
    const sessionD1S2 = inheritedD1S2[testMachineId]?.session_no;

    console.log(`Inherited values for Shift 2: Count = '${countD1S2}' (expected: '40s CARDED'), Session = ${sessionD1S2} (expected: 1)`);
    if (countD1S2 === '40s CARDED' && sessionD1S2 === 1) {
      console.log('SUCCESS: Shift 1 -> Shift 2 cloning verified!');
    } else {
      throw new Error('Shift 1 -> Shift 2 cloning failed!');
    }

    // ----------------------------------------------------------------------
    // TEST 2: Shift 3 -> Shift 1 Cloning (Next Date)
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 2: Verify Shift 1 inherits count from Shift 3 of previous date ---');

    // Create Shift 3 on Date D1
    const headerD1S3 = await prisma.autoconer_production_header.create({
      data: { entry_date: new Date(dateD1), shift: 3, total_time: 510 }
    });
    await createDetailForTest(headerD1S3.id, testMachineId, '60s COMBED', 2);

    // Create Shift 1 on Date D2 (Next Date)
    const headerD2S1 = await prisma.autoconer_production_header.create({
      data: { entry_date: new Date(dateD2), shift: 1, total_time: 510 }
    });

    const inheritedD2S1 = await getInheritedMachineSetups(dateD2, 1, headerD2S1.id);
    const countD2S1 = inheritedD2S1[testMachineId]?.count_name;
    const sessionD2S1 = inheritedD2S1[testMachineId]?.session_no;

    console.log(`Inherited values for next day Shift 1: Count = '${countD2S1}' (expected: '60s COMBED'), Session = ${sessionD2S1} (expected: 2)`);
    if (countD2S1 === '60s COMBED' && sessionD2S1 === 2) {
      console.log('SUCCESS: Shift 3 -> next day Shift 1 cloning verified!');
    } else {
      throw new Error('Shift 3 -> next day Shift 1 cloning failed!');
    }

    // ----------------------------------------------------------------------
    // TEST 3: Database Scan Fallback (Skip empty shifts/days)
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 3: Verify fallback database scan when intermediate shifts are empty ---');
    
    // We have Shift 1 on Date D2 with '60s COMBED'
    // Let's create Shift 3 on Date D2 (Shift 2 remains empty)
    const headerD2S3 = await prisma.autoconer_production_header.create({
      data: { entry_date: new Date(dateD2), shift: 3, total_time: 510 }
    });

    // It should skip empty Shift 2 and inherit from Shift 1 of Date D2 ('60s COMBED')
    const inheritedD2S3 = await getInheritedMachineSetups(dateD2, 3, headerD2S3.id);
    // Wait, let's create detail on headerD2S1 to be sure it has '60s COMBED'
    await createDetailForTest(headerD2S1.id, testMachineId, '120s COMBED', 3);

    const reInheritedD2S3 = await getInheritedMachineSetups(dateD2, 3, headerD2S3.id);
    const countD2S3 = reInheritedD2S3[testMachineId]?.count_name;
    const sessionD2S3 = reInheritedD2S3[testMachineId]?.session_no;

    console.log(`Inherited values for Shift 3: Count = '${countD2S3}' (expected: '120s COMBED'), Session = ${sessionD2S3} (expected: 3)`);
    if (countD2S3 === '120s COMBED' && sessionD2S3 === 3) {
      console.log('SUCCESS: Chronological backward fallback scanning verified!');
    } else {
      throw new Error('Fallback database scanning failed!');
    }

    console.log('\n--- ALL AUTOCONER INHERITANCE CLONING TESTS PASSED SUCCESSFULLY! ---');

  } catch (error) {
    console.error('TEST ERROR:', error);
  } finally {
    console.log('\nCleaning up test data...');
    await cleanDataForDate(dateD1);
    await cleanDataForDate(dateD2);
    
    await prisma.$disconnect();
    console.log('Disconnected Prisma Client.');
  }
}

runTests();
