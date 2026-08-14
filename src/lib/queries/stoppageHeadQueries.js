import { prisma } from '../prisma';
import { buildTypedSearchWhere } from '../masterSearch';

/**
 * Stoppage Head Master CRUD Operations
 */

// Get all stoppage heads
export async function getStoppageHeads() {
  const data = await prisma.stoppage_heads.findMany({
    orderBy: { code: 'asc' }
  });

  return data;
}

// Create new stoppage head
export async function createStoppageHead(stoppageData) {
  // If code is not provided, get max code + 1
  if (!stoppageData.code) {
    const maxData = await prisma.stoppage_heads.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true }
    });
    
    stoppageData.code = maxData && maxData.code ? maxData.code + 1 : 1;
  }

  const data = await prisma.stoppage_heads.create({
    data: stoppageData
  });

  return data;
}

// Update stoppage head
export async function updateStoppageHead(id, stoppageData) {
  const data = await prisma.stoppage_heads.update({
    where: { id },
    data: stoppageData
  });

  return data;
}

// Delete stoppage head
export async function deleteStoppageHead(id) {
  await prisma.stoppage_heads.delete({
    where: { id }
  });

  return true;
}

// Search stoppage heads
export async function searchStoppageHeads(field, condition, value) {
  const whereClause = buildTypedSearchWhere(field, condition, value, {
    code: 'number', stoppage_head_name: 'text'
  });

  const data = await prisma.stoppage_heads.findMany({
    where: whereClause,
    orderBy: { code: 'asc' }
  });

  return data;
}

// Generate next stoppage code
export async function generateStoppageCode(deptId) {
  const maxData = await prisma.stoppage_heads.findFirst({
    orderBy: { code: 'desc' },
    select: { code: true }
  });
  
  const nextCode = maxData && maxData.code ? maxData.code + 1 : 1;
  return { code: nextCode };
}
