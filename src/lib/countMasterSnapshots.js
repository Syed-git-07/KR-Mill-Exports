const hasValue = value => value !== null && value !== undefined && value !== ''

export function nullableNumber(value, { integer = false } = {}) {
  if (!hasValue(value)) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return integer ? Math.trunc(parsed) : parsed
}

export function buildSpinningCountSnapshot(count, { machineSpeed = null } = {}) {
  if (!count) {
    return {
      count_id: null,
      count_name: null,
      act_count: null,
      tpi: null,
      tw_con: null,
      doff_loss: null,
      c_waste_percent: null,
      conv_40s_value: null,
      speed: nullableNumber(machineSpeed, { integer: true })
    }
  }

  return {
    count_id: count.id,
    count_name: count.count_name,
    act_count: nullableNumber(count.act_count),
    tpi: nullableNumber(count.tpi),
    tw_con: nullableNumber(count.tw_con, { integer: true }),
    doff_loss: nullableNumber(count.doff_loss),
    c_waste_percent: nullableNumber(count.waste_percent),
    conv_40s_value: nullableNumber(count.conv_40s_value),
    speed: nullableNumber(count.speed, { integer: true })
      ?? nullableNumber(machineSpeed, { integer: true })
  }
}

export function buildAutoconerCountSnapshot(count) {
  if (!count) {
    return {
      count_id: null,
      count_name: null,
      act_count: null,
      speed: null,
      target_effi: null
    }
  }

  return {
    count_id: count.id,
    count_name: count.count_name,
    act_count: nullableNumber(count.act_count),
    speed: nullableNumber(count.speed_autoconer, { integer: true }),
    target_effi: nullableNumber(count.effi_actual_prodn ?? count.auto_effi)
  }
}
