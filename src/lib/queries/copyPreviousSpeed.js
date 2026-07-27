function toDate(value) {
  if (value instanceof Date) return value
  const dateOnly = String(value || '').split('T')[0]
  return new Date(`${dateOnly}T00:00:00.000Z`)
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
  targetDate,
  targetShift,
  sourceDate,
  updateSpeed
}) {
  const shift = Number.parseInt(targetShift, 10)
  const sourceDateValue = toDate(sourceDate)
  const targetDateValue = toDate(targetDate)

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
      },
      select: {
        id: true,
        machine_id: true
      }
    })
  ])

  if (sourceSetups.length === 0) {
    throw new Error(`No machine setup speeds found for ${String(sourceDate).split('T')[0]} shift ${shift}`)
  }

  if (targetSetups.length === 0) {
    throw new Error('No machine setups found for the current date and shift')
  }

  const sourceSpeedByMachine = new Map(
    sourceSetups.map(setup => [setup.machine_id, Number(setup.speed)])
  )
  const matchingTargets = targetSetups.filter(setup => sourceSpeedByMachine.has(setup.machine_id))

  await Promise.all(
    matchingTargets.map(setup => updateSpeed(setup.id, sourceSpeedByMachine.get(setup.machine_id)))
  )

  return {
    success: true,
    copiedFrom: String(sourceDate).split('T')[0],
    shift,
    machinesUpdated: matchingTargets.length
  }
}
