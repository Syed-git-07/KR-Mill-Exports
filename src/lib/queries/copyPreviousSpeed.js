import { prisma } from '../prisma'

function toDate(value) {
  const dateOnly = value instanceof Date
    ? (Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10))
    : String(value || '').split('T')[0]

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return new Date(Number.NaN)
  const normalized = new Date(`${dateOnly}T00:00:00.000Z`)
  return normalized.toISOString().slice(0, 10) === dateOnly
    ? normalized
    : new Date(Number.NaN)
}

export async function getAvailablePreviousSpeedDates(setupModel, beforeDate, shift, limit = 30) {
  return setupModel.groupBy({
    by: ['entry_date', 'shift'],
    where: {
      entry_date: { lt: toDate(beforeDate) },
      shift: Number.parseInt(shift, 10),
      speed: { not: null }
    },
    orderBy: {
      entry_date: 'desc'
    },
    take: limit
  })
}

export async function copyPreviousSpeeds({
  setupModel,
  headerModel,
  targetHeaderId,
  targetDate,
  targetShift,
  sourceDate,
  buildUpdateData = (_setup, speed) => ({ speed })
}) {
  const shift = Number.parseInt(targetShift, 10)
  const targetDateValue = toDate(targetDate)
  if (!targetHeaderId || !Number.isInteger(shift) || shift < 1 || shift > 3 || Number.isNaN(targetDateValue.getTime())) {
    throw new Error('The target production entry is invalid')
  }

  const targetHeader = await headerModel.findUnique({
    where: { id: targetHeaderId },
    select: { entry_date: true, shift: true }
  })
  if (
    !targetHeader
    || targetHeader.shift !== shift
    || targetHeader.entry_date.toISOString().slice(0, 10) !== targetDateValue.toISOString().slice(0, 10)
  ) {
    throw new Error('The target production entry does not match the selected date and shift')
  }

  let sourceDateValue
  if (sourceDate) {
    sourceDateValue = toDate(sourceDate)
  } else {
    const [latest] = await getAvailablePreviousSpeedDates(setupModel, targetDateValue, shift, 1)
    sourceDateValue = latest?.entry_date
  }

  if (!sourceDateValue || Number.isNaN(sourceDateValue.getTime()) || sourceDateValue >= targetDateValue) {
    throw new Error('Select an earlier source date with machine setup speeds')
  }

  const [sourceSetups, targetSetups] = await Promise.all([
    setupModel.findMany({
      where: {
        entry_date: sourceDateValue,
        shift,
        speed: { not: null }
      },
      select: {
        machine_id: true,
        speed: true
      }
    }),
    setupModel.findMany({
      where: {
        entry_date: targetDateValue,
        shift
      }
    })
  ])

  if (sourceSetups.length === 0) {
    throw new Error(`No machine setup speeds found for ${sourceDateValue.toISOString().slice(0, 10)} shift ${shift}`)
  }

  if (targetSetups.length === 0) {
    throw new Error('No machine setups found for the current date and shift')
  }

  const sourceSpeedByMachine = new Map(
    sourceSetups
      .map(setup => [setup.machine_id, Number(setup.speed)])
      .filter(([, speed]) => Number.isFinite(speed) && speed >= 0)
  )
  const matchingTargets = targetSetups.filter(setup => sourceSpeedByMachine.has(setup.machine_id))

  if (matchingTargets.length === 0) {
    throw new Error('No matching machines were found between the selected dates')
  }

  await prisma.$transaction(
    matchingTargets.map(setup => setupModel.update({
      where: { id: setup.id },
      data: buildUpdateData(setup, sourceSpeedByMachine.get(setup.machine_id))
    }))
  )

  return {
    success: true,
    copiedFrom: sourceDateValue.toISOString().slice(0, 10),
    shift,
    machinesUpdated: matchingTargets.length
  }
}
