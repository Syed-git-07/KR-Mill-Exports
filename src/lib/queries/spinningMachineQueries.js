import { prisma } from '../prisma';

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
    const { speed, count_name, act_count, tpi, ...machineFields } = machineData;

    const processedData = { ...machineFields };
    if (processedData.installed_date && typeof processedData.installed_date === 'string') {
      processedData.installed_date = new Date(processedData.installed_date);
    }

    // Check for an existing machine with the same machine_no to avoid duplicates
    const existing = await prisma.spinning_machines.findFirst({
      where: { machine_no: { equals: processedData.machine_no } }
    });

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

    // NOTE: Machine setup records are NOT created here.
    // They are only created when the machine is explicitly added via the Machine Setup tab.

    return machine;
  } catch (error) {
    console.error('Prisma error creating spinning machine:', error);
    throw new Error(error.message || 'Failed to create spinning machine');
  }
}

// Update spinning machine
export async function updateSpinningMachine(id, machineData) {
  // Extract setup-specific fields — they don't exist as columns in spinning_machines
  const { speed, count_name, act_count, tpi, ...restData } = machineData;

  const processedData = { ...restData };
  if (processedData.installed_date && typeof processedData.installed_date === 'string') {
    processedData.installed_date = new Date(processedData.installed_date);
  }

  const data = await prisma.spinning_machines.update({
    where: { id },
    data: {
      ...processedData,
      // When toggling is_active, update the timestamps accordingly
      ...(processedData.is_active === true  && { activated_at: new Date(), deactivated_at: null }),
      ...(processedData.is_active === false && { deactivated_at: new Date() }),
    }
  });

  // Update the setup row (count/tpi/speed/act_count) if any are provided
  const setupUpdate = {};
  if (speed !== undefined) setupUpdate.speed = speed;
  if (count_name !== undefined) setupUpdate.count_name = count_name;
  if (act_count !== undefined) setupUpdate.act_count = act_count;
  if (tpi !== undefined) setupUpdate.tpi = tpi;

  if (Object.keys(setupUpdate).length > 0) {
    await prisma.spinning_machine_setup.updateMany({
      where: { 
        machine_id: id,
        entry_date: new Date('2026-04-01'),
        shift: 1
      },
      data: setupUpdate
    });
  }

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

  return {
    ...machine,
    count_name: setup?.count_name || null,
    act_count: setup?.act_count != null ? parseFloat(setup.act_count) : null,
    tpi: setup?.tpi != null ? parseFloat(setup.tpi) : null,
    speed: setup?.speed || null,
  };
}

// Activate (reactivate) a spinning machine
export async function activateSpinningMachine(id) {
  return await prisma.spinning_machines.update({
    where: { id },
    data: { is_active: true, activated_at: new Date(), deactivated_at: null }
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
