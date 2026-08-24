const { URL } = require('node:url')
const { existsSync } = require('node:fs')
const dotenv = require('dotenv')

dotenv.config({ path: '.env', quiet: true })
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true, quiet: true })
}

function fail(message) {
  console.error(`Production security check failed: ${message}`)
  process.exitCode = 1
}

function checkDatabaseUrl(name) {
  const value = process.env[name]
  if (!value) {
    fail(`${name} is required.`)
    return null
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'mysql:') fail(`${name} must use MySQL.`)
    if (!url.username || !url.password) {
      fail(`${name} must contain dedicated database credentials.`)
    }
    if (decodeURIComponent(url.username).toLowerCase() === 'root') {
      fail(`${name} must not connect to MySQL as root. Use a least-privilege service account.`)
    }
    if (!url.pathname || url.pathname === '/') fail(`${name} must include a database name.`)
    return url
  } catch {
    fail(`${name} is not a valid MySQL connection URL.`)
    return null
  }
}

function checkPayrollCompanyId() {
  const value = Number(process.env.PAYROLL_COMPANY_ID)
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail('PAYROLL_COMPANY_ID must be a positive integer.')
  }
}

function checkTrustedOrigins() {
  const values = (process.env.AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (values.length === 0) {
    fail('AUTH_TRUSTED_ORIGINS must contain the public HTTPS origin.')
    return
  }

  for (const value of values) {
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:') {
        fail(`Trusted origin ${value} must use HTTPS.`)
      }
      if (url.origin !== value.replace(/\/$/, '')) {
        fail(`Trusted origin ${value} must not contain a path, query, or fragment.`)
      }
    } catch {
      fail(`Trusted origin ${value} is not a valid absolute URL.`)
    }
  }
}

const productionUrl = checkDatabaseUrl('DATABASE_URL')
const payrollUrl = checkDatabaseUrl('PAYROLL_DATABASE_URL')
checkPayrollCompanyId()

if (productionUrl && payrollUrl) {
  const productionTarget = `${productionUrl.hostname}:${productionUrl.port || '3306'}${productionUrl.pathname}`.toLowerCase()
  const payrollTarget = `${payrollUrl.hostname}:${payrollUrl.port || '3306'}${payrollUrl.pathname}`.toLowerCase()
  if (productionTarget === payrollTarget) {
    fail('DATABASE_URL and PAYROLL_DATABASE_URL must target different databases.')
  }
}

checkTrustedOrigins()

if (!process.exitCode) {
  console.log('Production security configuration check passed.')
}
