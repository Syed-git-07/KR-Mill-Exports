import { updateProductionDetail } from './src/lib/queries/cardingEntryQueries.js';
import { prisma } from './src/lib/prisma.js';

async function run() {
  const detail = await prisma.carding_production_detail.findFirst();
  if (!detail) {
    console.log("No detail found");
    return;
  }
  console.log("Detail ID:", detail.id);
  const result = await updateProductionDetail(detail.id, {
    act_prodn: 20,
    act_hank: 5
  });
  console.log("Result:", result);
}
run().catch(console.error).finally(() => prisma.$disconnect());
