import { prisma } from '../prisma';

/**
 * Autoconer Machine Master CRUD Operations
 */

// Get all autoconer machines - sorted by group_id then machine number (active only)
export async function getAutoconerMachines() {
  const data = await prisma.autoconer_machines.findMany({});
  
  // Sort: active first, then by group_id, then machine_no naturally
  if (data) {
    data.sort((a, b) => {
      // Active machines come first
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;

      // Then sort by group_id numerically
      const groupA = a.group_id || 999;
      const groupB = b.group_id || 999;
      if (groupA !== groupB) return groupA - groupB;
      
      // Then sort by machine_no naturally (AC1-1, AC1-2, AC1-3, etc.)
      const machineNoA = a.machine_no || '';
      const machineNoB = b.machine_no || '';
      
      // Extract group and sub-number for natural sorting
      const matchA = machineNoA.match(/^AC(\d+)-(\d+)$/i);
      const matchB = machineNoB.match(/^AC(\d+)-(\d+)$/i);
      
      if (matchA && matchB) {
        const groupNumA = parseInt(matchA[1], 10);
        const groupNumB = parseInt(matchB[1], 10);
        if (groupNumA !== groupNumB) return groupNumA - groupNumB;
        
        const subNumA = parseInt(matchA[2], 10);
        const subNumB = parseInt(matchB[2], 10);
        return subNumA - subNumB;
      }
      
      // Fallback to string comparison
      return machineNoA.localeCompare(machineNoB, undefined, { numeric: true });
    });
  }
  
  return data;
}

// Get next available mc_id
export async function getNextMcId() {
  const data = await prisma.autoconer_machines.findFirst({
    orderBy: { mc_id: 'desc' },
    select: { mc_id: true }
  });
  
  // Return next available mc_id (max + 1, or 1 if no records)
  return data && data.mc_id ? data.mc_id + 1 : 1;
}

// Create new autoconer machine (with setup and add to existing headers)
export async function createAutoconerMachine(machineData) {
  // Auto-generate mc_id if not provided
  if (!machineData.mc_id) {
    machineData.mc_id = await getNextMcId();
  }

  // Convert date string to Date object if it exists
  const processedData = { ...machineData };
  if (processedData.installed_date && typeof processedData.installed_date === 'string') {
    processedData.installed_date = new Date(processedData.installed_date);
  }
  // Set activated_at to today when creating a new machine
  processedData.activated_at = new Date();

  try {
    const newMachine = await prisma.autoconer_machines.create({
      data: processedData
    });

    // NOTE: Machine setup and production entries are NOT created here.
    // They are only created when the machine is explicitly added via the
    // Machine Setup tab in the production entry page.

    return newMachine;
  } catch (error) {
    console.error('Prisma error creating autoconer machine:', error);
    throw new Error(error.message || 'Failed to create autoconer machine');
  }
}

// Helper function to add machine to existing production headers
async function addMachineToExistingProductionHeaders(machineId, machineData) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get existing production headers
  const headers = await prisma.autoconer_production_header.findMany({
    where: {
      entry_date: { gte: sevenDaysAgo }
    },
    select: { id: true }
  });

  if (!headers || headers.length === 0) return;

  for (const header of headers) {
    // Check if already exists
    const existing = await prisma.autoconer_production_detail.findFirst({
      where: {
        header_id: header.id,
        machine_id: machineId
      }
    });

    if (existing) continue;

    // Create production detail
    try {
      const detail = await prisma.autoconer_production_detail.create({
        data: {
          header_id: header.id,
          machine_id: machineId,
          count_name: machineData?.count_name || null,
          count_id: machineData?.count_id || null,
          session_no: 1,
          work_time: 510,
          total_stoppage_mins: 0
        }
      });

      // Create stoppage entry
      await prisma.autoconer_stoppage_entry.create({
        data: {
          production_detail_id: detail.id,
          run_time: 510,
          total_stoppage_time: 0
        }
      });
    } catch (detailError) {
      console.error('Error creating production detail:', detailError);
      continue;
    }
  }
}

// Update autoconer machine
export async function updateAutoconerMachine(id, machineData) {
  // Convert date string to Date object if it exists
  const processedData = { ...machineData };
  if (processedData.installed_date && typeof processedData.installed_date === 'string') {
    processedData.installed_date = new Date(processedData.installed_date);
  }
  
  // Set activated_at / deactivated_at when is_active changes
  if (processedData.is_active === true) {
    processedData.activated_at = new Date();
    processedData.deactivated_at = null;
  } else if (processedData.is_active === false) {
    processedData.deactivated_at = new Date();
  }

  const data = await prisma.autoconer_machines.update({
    where: { id },
    data: processedData
  });
  
  return data;
}

// Delete autoconer machine
export async function deleteAutoconerMachine(id) {
  await prisma.autoconer_machines.delete({
    where: { id }
  });
  
  return true;
}

// Search autoconer machines (active only)
export async function searchAutoconerMachines(field, condition, value) {
  // Define numeric fields for proper type conversion
  const numericFields = ['mc_id', 'group_id', 'from_drum', 'to_drum', 'no_of_drums', 'act_effi'];
  const decimalFields = ['speed'];
  const booleanFields = ['is_active', 'direct_prod_entry'];
  const dateFields = ['installed_date'];

  let whereClause = {};

  if (value && value.trim() !== '') {
    switch (condition) {
      case 'Like':
        // MySQL doesn't support mode: 'insensitive', but string comparisons are case-insensitive by default
        whereClause[field] = { contains: value };
        break;
      case 'Equal':
        if (numericFields.includes(field)) {
          whereClause[field] = parseInt(value);
        } else if (decimalFields.includes(field)) {
          whereClause[field] = parseFloat(value);
        } else if (booleanFields.includes(field)) {
          whereClause[field] = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
        } else if (dateFields.includes(field)) {
          whereClause[field] = new Date(value);
        } else {
          whereClause[field] = value;
        }
        break;
      case 'Not Equal':
        if (numericFields.includes(field)) {
          whereClause[field] = { not: parseInt(value) };
        } else if (decimalFields.includes(field)) {
          whereClause[field] = { not: parseFloat(value) };
        } else if (booleanFields.includes(field)) {
          whereClause[field] = { not: value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' };
        } else {
          whereClause[field] = { not: value };
        }
        break;
      case 'Greater':
        if (numericFields.includes(field)) {
          whereClause[field] = { gt: parseInt(value) };
        } else if (decimalFields.includes(field)) {
          whereClause[field] = { gt: parseFloat(value) };
        } else if (dateFields.includes(field)) {
          whereClause[field] = { gt: new Date(value) };
        }
        break;
      case 'Less':
        if (numericFields.includes(field)) {
          whereClause[field] = { lt: parseInt(value) };
        } else if (decimalFields.includes(field)) {
          whereClause[field] = { lt: parseFloat(value) };
        } else if (dateFields.includes(field)) {
          whereClause[field] = { lt: new Date(value) };
        }
        break;
    }
  }

  const data = await prisma.autoconer_machines.findMany({
    where: whereClause,
    orderBy: { machine_no: 'asc' }
  });
  
  return data;
}
