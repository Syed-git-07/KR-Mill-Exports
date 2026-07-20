const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Adding activated_at column...');
    await prisma.$executeRawUnsafe(`ALTER TABLE spinning_machines ADD COLUMN IF NOT EXISTS activated_at DATE NULL`);

    console.log('Adding deactivated_at column...');
    await prisma.$executeRawUnsafe(`ALTER TABLE spinning_machines ADD COLUMN IF NOT EXISTS deactivated_at DATE NULL`);

    console.log('Backfilling active machines...');
    const active = await prisma.$executeRawUnsafe(
      `UPDATE spinning_machines SET activated_at = COALESCE(installed_date, DATE(created_at)) WHERE activated_at IS NULL AND (is_active = 1 OR is_active IS NULL)`
    );
    console.log(`  Updated ${active} active machines`);

    console.log('Backfilling inactive machines...');
    const inactive = await prisma.$executeRawUnsafe(
      `UPDATE spinning_machines SET activated_at = COALESCE(installed_date, DATE(created_at)), deactivated_at = CURDATE() WHERE activated_at IS NULL AND is_active = 0`
    );
    console.log(`  Updated ${inactive} inactive machines`);

    console.log('\nVerification:');
    const rows = await prisma.$queryRawUnsafe(
      'SELECT machine_no, is_active, activated_at, deactivated_at FROM spinning_machines LIMIT 10'
    );
    console.log(JSON.stringify(rows, null, 2));
    console.log('\nMigration complete!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
