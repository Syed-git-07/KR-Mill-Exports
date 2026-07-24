export function findFirstFreeStoppageSlot(entry) {
  for (let slot = 1; slot <= 4; slot += 1) {
    const value = entry?.[`stoppage${slot}_id`]
    if (value === null || value === undefined || value === '') {
      return slot
    }
  }

  return null
}

export function getStoppageTotal(entry) {
  return [1, 2, 3, 4].reduce(
    (total, slot) => total + (Number(entry?.[`stoppage${slot}_time`]) || 0),
    0
  )
}
