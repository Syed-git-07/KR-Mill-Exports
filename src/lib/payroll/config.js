function requiredEnvironmentValue(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) {
    throw new Error(`${name} is required for payroll access.`)
  }
  return value
}

export function getPayrollDatabaseUrl() {
  const value = requiredEnvironmentValue('PAYROLL_DATABASE_URL')

  try {
    const url = new URL(value)
    if (url.protocol !== 'mysql:') throw new Error('unsupported protocol')
    if (!url.pathname || url.pathname === '/') throw new Error('missing database name')
  } catch {
    throw new Error('PAYROLL_DATABASE_URL must be a valid MySQL connection URL with a database name.')
  }

  return value
}

export function getPayrollDatabaseName() {
  const url = new URL(getPayrollDatabaseUrl())
  return decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ''))
}

export function getPayrollCompanyId() {
  const rawValue = requiredEnvironmentValue('PAYROLL_COMPANY_ID')
  const companyId = Number(rawValue)

  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new Error('PAYROLL_COMPANY_ID must be a positive integer.')
  }

  return companyId
}

export function getPayrollHolidayWriter() {
  const writer = String(process.env.PAYROLL_HOLIDAY_WRITER || 'PAYROLL').trim().toUpperCase()
  if (!['PAYROLL', 'KR_PRODUCTION'].includes(writer)) {
    throw new Error('PAYROLL_HOLIDAY_WRITER must be PAYROLL or KR_PRODUCTION.')
  }
  return writer
}

export function canKrProductionWritePayrollHolidays() {
  return getPayrollHolidayWriter() === 'KR_PRODUCTION'
}

export function assertKrProductionHolidayWriter() {
  if (!canKrProductionWritePayrollHolidays()) {
    throw new Error('Holiday data is read-only here because Payroll is the configured authoritative writer.')
  }
}
