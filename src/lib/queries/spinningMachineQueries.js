import { prisma } from '../prisma';

const SPINNING_DEFAULT_SETUP_DATE = new Date('2026-04-01T00:00:00.000Z');

async function upsertDefaultSpinningSetup(machineId, setupFields) {
  const data = Object.fromEntries(
    Object.entries(setupFields).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(data).length === 0) return null;

  return prisma.spinning_machine_setup.upsert({
    where: {
      idx_spinning_machine_setup_date: {
        machine_id: machineId,
        entry_date: SPINNING_DEFAULT_SETUP_DATE,
        shift: 1,
      }
    },
    update: data,
    create: {
      machine_id: machineId,
      entry_date: SPINNING_DEFAULT_SETUP_DATE,
      shift: 1,
      ...data,
    }
  });
}

/**
 * Spinning Machine Master CRUD Operations
 */

// Get all spinning machines
export async function getSpinningMachines() {
  const data = await prisma.spinning_machines.findMany({});

  // Sort: active machines first, then by numeric machine_no
  const sorted = sortMachinesByNumber(data || []);
  return sorted.sort((a, b) => {
    if (a.is_active === b.is_active) return 0;
    return a.is_active ? -1 : 1;
  });
}

// Helper function to sort machines by number properly
function sortMachinesByNumber(machines) {
  return machines.sort((a, b) => {
    const aNum = parseInt(a.machine_no.replace(/[^0-9]/g, '')) || 0;
    const bNum = parseInt(b.machine_no.replace(/[^0-9]/g, '')) || 0;
    
    // First compare numeric part
    if (aNum !== bNum) {
      return aNum - bNum;
    }
    
    // If same number, pure numbers come before alphanumeric (1 before 1A)
    const aHasLetter = /[A-Za-z]/.test(a.machine_no);
    const bHasLetter = /[A-Za-z]/.test(b.machine_no);
    
    if (!aHasLetter && bHasLetter) return -1;
    if (aHasLetter && !bHasLetter) return 1;
    
    // Both have letters or both don't - sort alphabetically
    return a.machine_no.localeCompare(b.machine_no);
  });
}

// Create new spinning machine
export async function createSpinningMachine(machineData) {
  try {
    // Extract setup-specific fields so they don't land in spinning_machines
    const { speed, count_name, act_count, tpi, tw_con, doff_loss, c_waste_percent, ...machineFields } = machineData;

    const processedData = { ...machineFields };
    if (processedData.installed_date && typeof processedData.installed_date === 'string') {
      processedData.installed_date = new Date(processedData.installed_date);
    }

    // Check for an existing machine with the same machine_no to avoid duplicates
    const existing = await prisma.spinning_machines.findFirst({
      where: { machine_no: { equals: processedData.machine_no } }
    });

    let finalSpeed = speed;
    let finalTpi = tpi;
    let finalActCount = act_count;
    let finalTwCon = tw_con;
    let finalDoffLoss = doff_loss;
    let finalWastePercent = c_waste_percent;
    
    if (count_name) {
      const countMaster = await prisma.spinning_counts.findFirst({ where: { count_name, is_active: true } });
      if (countMaster) {
        if (finalActCount != null && parseFloat(finalActCount) === parseFloat(countMaster.act_count)) finalActCount = null;
        if (finalTpi != null && parseFloat(finalTpi) === parseFloat(countMaster.tpi)) finalTpi = null;
        if (finalSpeed != null && parseInt(finalSpeed) === parseInt(countMaster.speed)) finalSpeed = null;
        if (finalTwCon != null && parseInt(finalTwCon) === parseInt(countMaster.tw_con)) finalTwCon = null;
        if (finalDoffLoss != null && parseFloat(finalDoffLoss) === parseFloat(countMaster.doff_loss)) finalDoffLoss = null;
        if (finalWastePercent != null && parseFloat(finalWastePercent) === parseFloat(countMaster.waste_percent)) finalWastePercent = null;
      }
    }

    if (existing) {
      if (!existing.is_active) {
        // Reactivate the inactive machine instead of creating a duplicate
        const reactivated = await prisma.spinning_machines.update({
          where: { id: existing.id },
          data: {
            ...processedData,
            is_active: true,
            activated_at: new Date(),
            deactivated_at: null,
          }
        });
        await upsertDefaultSpinningSetup(reactivated.id, {
          speed: finalSpeed,
          count_name,
          act_count: finalActCount,
          tpi: finalTpi,
          tw_con: finalTwCon,
          doff_loss: finalDoffLoss,
          c_waste_percent: finalWastePercent,
          allocated_spindles: processedData.allocated_spindles,
        });
        return reactivated;
      } else {
        throw new Error(`Machine ${processedData.machine_no} already exists and is active`);
      }
    }

    // Fetch max sort_order so new machine goes to the end
    const maxSortResult = await prisma.spinning_machines.aggregate({ _max: { sort_order: true } });
    const nextSortOrder = (maxSortResult._max.sort_order ?? 0) + 1;

    const machine = await prisma.spinning_machines.create({
      data: { ...processedData, activated_at: new Date(), sort_order: nextSortOrder }
    });

    // Keep the baseline setup in sync with the master. New dated entries clone
    // this row and then refresh count-controlled values from the counts master.
    await upsertDefaultSpinningSetup(machine.id, {
      speed: finalSpeed,
      count_name,
      act_count: finalActCount,
      tpi: finalTpi,
      tw_con: finalTwCon,
      doff_loss: finalDoffLoss,
      c_waste_percent: finalWastePercent,
      allocated_spindles: processedData.allocated_spindles,
    });

    return machine;
  } catch (error) {
    console.error('Prisma error creating spinning machine:', error);
    throw new Error(error.message || 'Failed to create spinning machine');
  }
}

// Update spinning machine
export async function updateSpinningMachine(id, machineData) {
  // Extract setup-specific fields — they don't exist as columns in spinning_machines
  const { speed, count_name, act_count, tpi, tw_con, doff_loss, c_waste_percent, ...restData } = machineData;

  const processedData = { ...restData };
  if (processedData.installed_date && typeof processedData.installed_date === 'string') {
    processedData.installed_date = new Date(processedData.installed_date);
  }

  const currentMachine = await prisma.spinning_machines.findUnique({
    where: { id },
    select: { is_active: true },
  });
  const isActivating = processedData.is_active === true && currentMachine?.is_active !== true;
  const isDeactivating = processedData.is_active === false && currentMachine?.is_active !== false;

  const data = await prisma.spinning_machines.update({
    where: { id },
    data: {
      ...processedData,
      ...(isActivating && { activated_at: new Date(), deactivated_at: null }),
      ...(isDeactivating && { deactivated_at: new Date() }),
    }
  });

  let finalSpeed = speed;
  let finalTpi = tpi;
  let finalActCount = act_count;
  let finalTwCon = tw_con;
  let finalDoffLoss = doff_loss;
  let finalWastePercent = c_waste_percent;
  
  if (count_name) {
    const countMaster = await prisma.spinning_counts.findFirst({ where: { count_name, is_active: true } });
    if (countMaster) {
      if (finalActCount != null && parseFloat(finalActCount) === parseFloat(countMaster.act_count)) finalActCount = null;
      if (finalTpi != null && parseFloat(finalTpi) === parseFloat(countMaster.tpi)) finalTpi = null;
      if (finalSpeed != null && parseInt(finalSpeed) === parseInt(countMaster.speed)) finalSpeed = null;
      if (finalTwCon != null && parseInt(finalTwCon) === parseInt(countMaster.tw_con)) finalTwCon = null;
      if (finalDoffLoss != null && parseFloat(finalDoffLoss) === parseFloat(countMaster.doff_loss)) finalDoffLoss = null;
      if (finalWastePercent != null && parseFloat(finalWastePercent) === parseFloat(countMaster.waste_percent)) finalWastePercent = null;
    }
  }

  // Update or create the baseline setup so master speed/TPI/count/spindles are
  // the source for newly-created dated entries. Explicit zero is valid.
  await upsertDefaultSpinningSetup(id, {
    speed: finalSpeed,
    count_name,
    act_count: finalActCount,
    tpi: finalTpi,
    tw_con: finalTwCon,
    doff_loss: finalDoffLoss,
    c_waste_percent: finalWastePercent,
    allocated_spindles: processedData.allocated_spindles,
  });

  return data;
}

// Get spinning machine with its setup data (for the edit form)
export async function getSpinningMachineWithSetup(id) {
  const machine = await prisma.spinning_machines.findUnique({ where: { id } });
  if (!machine) return null;

  const setup = await prisma.spinning_machine_setup.findFirst({
    where: { 
      machine_id: id,
      entry_date: new Date('2026-04-01'),
      shift: 1
    }
  });
  
  let finalSpeed = setup?.speed ?? null;
  let finalTpi = setup?.tpi ?? null;
  let finalActCount = setup?.act_count ?? null;
  let finalTwCon = setup?.tw_con ?? null;
  let finalDoffLoss = setup?.doff_loss ?? null;
  let finalWastePercent = setup?.c_waste_percent ?? null;
  
  if (setup?.count_name) {
    const countMaster = await prisma.spinning_counts.findFirst({ where: { count_name: setup.count_name, is_active: true } });
    if (countMaster) {
      if (finalActCount == null && countMaster.act_count != null) finalActCount = parseFloat(countMaster.act_count);
      if (finalTpi == null && countMaster.tpi != null) finalTpi = parseFloat(countMaster.tpi);
      if (finalSpeed == null && countMaster.speed != null) finalSpeed = parseInt(countMaster.speed);
      if (finalTwCon == null && countMaster.tw_con != null) finalTwCon = parseInt(countMaster.tw_con);
      if (finalDoffLoss == null && countMaster.doff_loss != null) finalDoffLoss = parseFloat(countMaster.doff_loss);
      if (finalWastePercent == null && countMaster.waste_percent != null) finalWastePercent = parseFloat(countMaster.waste_percent);
    }
  }

  return {
    ...machine,
    count_name: setup?.count_name || null,
    act_count: finalActCount != null ? parseFloat(finalActCount) : null,
    tpi: finalTpi != null ? parseFloat(finalTpi) : null,
    speed: finalSpeed ?? null,
    tw_con: finalTwCon != null ? parseInt(finalTwCon) : null,
    doff_loss: finalDoffLoss != null ? parseFloat(finalDoffLoss) : null,
    c_waste_percent: finalWastePercent != null ? parseFloat(finalWastePercent) : null,
  };
}

// Activate (reactivate) a spinning machine
export async function activateSpinningMachine(id) {
  const machine = await prisma.spinning_machines.findUnique({ where: { id } });
  if (!machine || machine.is_active === true) return machine;

  return prisma.spinning_machines.update({
    where: { id },
    data: { is_active: true, activated_at: new Date(), deactivated_at: null },
  });
}

// Delete spinning machine
export async function deleteSpinningMachine(id) {
  await prisma.spinning_machines.delete({
    where: { id }
  });

  return true;
}

// Search spinning machines
export async function searchSpinningMachines(field, condition, value) {
  let whereClause = {};

  if (value && value.trim() !== '') {
    switch (condition) {
      case 'Like':
        // MySQL doesn't support mode: 'insensitive', but string comparisons are case-insensitive by default
        whereClause[field] = { contains: value };
        break;
      case 'Equal':
        if (field === 'allocated_spindles') {
          whereClause[field] = parseInt(value);
        } else if (field === 'is_active') {
          whereClause[field] = value.toLowerCase() === 'true';
        } else {
          whereClause[field] = value;
        }
        break;
      case 'Not Equal':
        if (field === 'allocated_spindles') {
          whereClause[field] = { not: parseInt(value) };
        } else {
          whereClause[field] = { not: value };
        }
        break;
      case 'Greater':
        if (field === 'allocated_spindles') {
          whereClause[field] = { gt: parseInt(value) };
        }
        break;
      case 'Less':
        if (field === 'allocated_spindles') {
          whereClause[field] = { lt: parseInt(value) };
        }
        break;
    }
  }
  
  const data = await prisma.spinning_machines.findMany({
    where: whereClause
  });
  
  // Apply proper numeric sorting
  return sortMachinesByNumber(data || []);
}
