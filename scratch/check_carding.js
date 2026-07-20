const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('Fetching carding machines...');
  const machines = await prisma.carding_machines.findMany({
    where: {
      is_active: true
    },
    select: {
      id: true,
      machine_no: true,
      make_name: true,
      is_active: true
    },
    orderBy: {
      machine_no: 'asc'
    }
  });

  console.log('Total machines found:', machines.length);
  machines.forEach(m => {
    console.log(`Machine: ${m.machine_no}, Make Name: "${m.make_name}"`);
  });

  await prisma.$disconnect();
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
