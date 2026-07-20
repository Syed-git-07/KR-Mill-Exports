import { isHoliday } from '../src/lib/queries/holidayListQueries.js';

async function test() {
  try {
    const res1 = await isHoliday('2026-05-01');
    console.log("Labour Day (2026-05-01) result:", res1);
    
    const res2 = await isHoliday('2026-05-02');
    console.log("Non-holiday (2026-05-02) result:", res2);
  } catch (e) {
    console.error("Failed with error:", e);
  }
}

test().then(() => process.exit(0));
