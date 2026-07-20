import { prisma } from '../prisma';

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
  let whereClause = {};

  if (value && value.trim() !== '') {
    const trimmedValue = value.trim();
    
    switch (condition) {
      case 'Like':
        if (field === 'code') {
          // For code field, use exact match
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            whereClause[field] = numValue;
          }
        } else {
          // MySQL doesn't support mode: 'insensitive', but string comparisons are case-insensitive by default
          whereClause[field] = { contains: trimmedValue };
        }
        break;
      case 'Equal':
        if (field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            whereClause[field] = numValue;
          }
        } else {
          whereClause[field] = trimmedValue;
        }
        break;
      case 'Not Equal':
        if (field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            whereClause[field] = { not: numValue };
          }
        } else {
          whereClause[field] = { not: trimmedValue };
        }
        break;
      case 'Greater':
        if (field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            whereClause[field] = { gt: numValue };
          }
        }
        break;
      case 'Less':
        if (field === 'code') {
          const numValue = parseInt(trimmedValue);
          if (!isNaN(numValue)) {
            whereClause[field] = { lt: numValue };
          }
        }
        break;
    }
  }

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
