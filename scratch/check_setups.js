const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCardingMachineSetups } = require('../src/lib/queries/cardingEntryQueries');

async function test() {
  console.log('Fetching carding machine setups using the backend query...');
  const result = await getCardingMachineSetups(new Date('2026-05-30'), 1);
  console.log('Total setups fetched:', result.length);
  if (result.length > 0) {
    console.log('First setup details:');
    console.log(JSON.stringify({
      id: result[0].id,
      machine_id: result[0].machine_id,
      speed: result[0].speed,
      machine: result[0].machine
    }, null, 2));
    
    console.log('All fetched machines and their make names:');
    result.forEach(r => {
      console.log(`McNo: ${r.machine?.machine_no}, MakeName: "${r.machine?.make_name}"`);
    });
  } else {
    console.log('No setups found for this date.');
  }
  await prisma.$disconnect();
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
