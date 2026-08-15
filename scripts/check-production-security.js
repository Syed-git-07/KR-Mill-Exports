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

function checkDatabaseUrl() {
  const value = process.env.DATABASE_URL
  if (!value) {
    fail('DATABASE_URL is required.')
    return
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'mysql:') fail('DATABASE_URL must use MySQL.')
    if (!url.username || !url.password) {
      fail('DATABASE_URL must contain dedicated database credentials.')
    }
    if (decodeURIComponent(url.username).toLowerCase() === 'root') {
      fail('The application must not connect to MySQL as root. Use a least-privilege service account.')
    }
  } catch {
    fail('DATABASE_URL is not a valid MySQL connection URL.')
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

checkDatabaseUrl()
checkTrustedOrigins()

if (!process.exitCode) {
  console.log('Production security configuration check passed.')
}
