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
