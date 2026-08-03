import { prisma } from '../prisma';
import { deleteUnusedStoppageHead } from './masterDeletion';

function cleanStoppageHeadData(stoppageData = {}) {
  const data = {};
  if (Object.prototype.hasOwnProperty.call(stoppageData, 'code')) {
    if (stoppageData.code == null || stoppageData.code === '') data.code = null;
    else {
      const code = Number(stoppageData.code);
      if (!Number.isInteger(code) || code <= 0) throw new Error('Code must be a positive whole number');
      data.code = code;
    }
  }
  if (Object.prototype.hasOwnProperty.call(stoppageData, 'stoppage_head_name')) {
    data.stoppage_head_name = String(stoppageData.stoppage_head_name ?? '').trim();
    if (!data.stoppage_head_name) throw new Error('Stoppage Head Name is required');
  }
  if (Object.prototype.hasOwnProperty.call(stoppageData, 'description')) {
    data.description = stoppageData.description == null || stoppageData.description === ''
      ? null
      : String(stoppageData.description).trim();
  }
  if (Object.prototype.hasOwnProperty.call(stoppageData, 'is_active')) {
    if (typeof stoppageData.is_active !== 'boolean') throw new Error('Active status must be true or false');
    data.is_active = stoppageData.is_active;
  }
  return data;
}

async function assertUniqueStoppageHead(transaction, data, excludeId = null) {
  const checks = [];
  if (data.code != null) checks.push({ code: data.code });
  if (data.stoppage_head_name) checks.push({ stoppage_head_name: { equals: data.stoppage_head_name } });
  if (!checks.length) return;
  const duplicate = await transaction.stoppage_heads.findFirst({
    where: { OR: checks, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { code: true, stoppage_head_name: true }
  });
  if (!duplicate) return;
  if (data.code != null && duplicate.code === data.code) throw new Error(`Stoppage head code ${data.code} already exists`);
  throw new Error(`Stoppage head "${data.stoppage_head_name}" already exists`);
}

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
  const cleanData = cleanStoppageHeadData(stoppageData);
  if (!cleanData.stoppage_head_name) throw new Error('Stoppage Head Name is required');
  if (cleanData.is_active === undefined) cleanData.is_active = true;

  return prisma.$transaction(async transaction => {
    if (!cleanData.code) {
      const maxData = await transaction.stoppage_heads.findFirst({
        orderBy: { code: 'desc' },
        select: { code: true }
      });
      cleanData.code = (maxData?.code ?? 0) + 1;
    }
    await assertUniqueStoppageHead(transaction, cleanData);
    return transaction.stoppage_heads.create({ data: cleanData });
  }, { isolationLevel: 'Serializable' });
}

// Update stoppage head
export async function updateStoppageHead(id, stoppageData) {
  if (!id) throw new Error('Stoppage head ID is required');
  const cleanData = cleanStoppageHeadData(stoppageData);
  return prisma.$transaction(async transaction => {
    const existing = await transaction.stoppage_heads.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new Error('Stoppage head not found');
    await assertUniqueStoppageHead(transaction, cleanData, id);
    // A head controls whether its children are offered for new entries. Keep
    // each detail's own active flag untouched so reactivating the head restores
    // exactly the child state that existed before deactivation.
    return transaction.stoppage_heads.update({ where: { id }, data: cleanData });
  });
}

// Delete stoppage head
export async function deleteStoppageHead(id) {
  return deleteUnusedStoppageHead(id);
}

// Search stoppage heads
export async function searchStoppageHeads(field, condition, value) {
  if (!new Set(['code', 'stoppage_head_name', 'description', 'is_active']).has(field)) {
    throw new Error('Unsupported stoppage head search field');
  }
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
