#!/usr/bin/env node

const path = require('node:path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true })
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true, quiet: true })

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const shouldApply = process.argv.includes('--apply')

const repairs = [
  {
    resource: 'master.autoconer-machine',
    machineNo: 'AC16-1',
    canonicalId: '2b35b128-1dd4-11f1-8945-3c0af3551fe0',
    duplicateId: '2b821d55-1dd4-11f1-8945-3c0af3551fe0'
  },
  {
    resource: 'master.autoconer-machine',
    machineNo: 'AC2-2',
    canonicalId: '81dda755-9823-4af4-ad37-63f6d07428d0',
    duplicateId: '3f5f2b58-23ab-11f1-a503-40c2ba800bce'
  }
]

async function referenceCounts(machineId) {
  const [setup, production] = await Promise.all([
    prisma.autoconer_machine_setup.count({ where: { machine_id: machineId } }),
    prisma.autoconer_production_detail.count({ where: { machine_id: machineId } })
  ])
  return { setup, production, total: setup + production }
}

async function inspectRepair(repair) {
  const [canonical, duplicate, activeMatches, canonicalRefs, duplicateRefs] = await Promise.all([
    prisma.autoconer_machines.findUnique({ where: { id: repair.canonicalId } }),
    prisma.autoconer_machines.findUnique({ where: { id: repair.duplicateId } }),
    prisma.autoconer_machines.count({
      where: { machine_no: repair.machineNo, is_active: true }
    }),
    referenceCounts(repair.canonicalId),
    referenceCounts(repair.duplicateId)
  ])

  const ready = Boolean(
    canonical &&
    duplicate &&
    canonical.machine_no === repair.machineNo &&
    duplicate.machine_no === repair.machineNo &&
    canonical.is_active === true &&
    duplicate.is_active === true &&
    activeMatches === 2 &&
    canonicalRefs.total > 0 &&
    duplicateRefs.total === 0
  )
  const alreadyApplied = Boolean(
    canonical &&
    duplicate &&
    canonical.machine_no === repair.machineNo &&
    duplicate.machine_no === repair.machineNo &&
    canonical.is_active === true &&
    duplicate.is_active === false &&
    activeMatches === 1 &&
    duplicateRefs.total === 0
  )

  return {
    ...repair,
    safe: ready || alreadyApplied,
    status: ready ? 'READY' : alreadyApplied ? 'ALREADY_APPLIED' : 'BLOCKED',
    activeMatches,
    canonical: canonical && { id: canonical.id, mc_id: canonical.mc_id, references: canonicalRefs },
    duplicate: duplicate && { id: duplicate.id, mc_id: duplicate.mc_id, references: duplicateRefs }
  }
}

async function main() {
  const inspection = await Promise.all(repairs.map(inspectRepair))
  console.log(JSON.stringify({ mode: shouldApply ? 'apply' : 'dry-run', inspection }, null, 2))

  if (inspection.some(item => !item.safe)) {
    throw new Error('Repair aborted because one or more preconditions no longer match')
  }
  if (!shouldApply) return

  const deactivatedAt = new Date()
  await prisma.$transaction(async tx => {
    for (const item of inspection.filter(candidate => candidate.status === 'READY')) {
      const result = await tx.autoconer_machines.updateMany({
        where: {
          id: item.duplicateId,
          machine_no: item.machineNo,
          is_active: true
        },
        data: { is_active: false, deactivated_at: deactivatedAt }
      })
      if (result.count !== 1) {
        throw new Error(`Repair lost its precondition for ${item.machineNo}`)
      }

      await tx.audit_logs.create({
        data: {
          username: 'maintenance-script',
          event_type: 'MASTER_MAINTENANCE',
          outcome: 'SUCCESS',
          action: 'DEACTIVATE_UNREFERENCED_DUPLICATE',
          resource: item.resource,
          details: {
            machine_no: item.machineNo,
            canonical_id: item.canonicalId,
            deactivated_duplicate_id: item.duplicateId,
            reason: 'Duplicate active row had no setup or production references'
          }
        }
      })
    }
  })

  const appliedCount = inspection.filter(item => item.status === 'READY').length
  console.log(`Deactivated ${appliedCount} unreferenced duplicate rows; ${inspection.length - appliedCount} were already repaired.`)
}

main()
  .catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
