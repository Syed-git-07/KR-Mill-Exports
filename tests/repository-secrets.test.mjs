import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

async function checkIgnored(paths) {
  try {
    const stdout = execFileSync(
      'git',
      ['check-ignore', '--no-index', '--stdin'],
      { input: `${paths.join('\n')}\n`, encoding: 'utf8' }
    )
    return new Set(stdout.trim().split(/\r?\n/).filter(Boolean))
  } catch (error) {
    // git check-ignore exits with 1 when none of the supplied paths are ignored.
    if (error.status === 1) return new Set()
    throw error
  }
}

test('server secrets and local runtime files stay out of GitHub source archives', async () => {
  const protectedPaths = [
    '.env',
    '.env.local',
    '.env.production',
    '.npmrc',
    '.netrc',
    '.vscode/settings.json',
    'credentials.json',
    'service-account-production.json',
    'server.key',
    'signing.pfx',
    'runtime.pid',
    'backups/production.sql',
    'storage/application.log'
  ]
  const ignored = await checkIgnored(protectedPaths)

  for (const file of protectedPaths) {
    assert.equal(ignored.has(file), true, `${file} must remain ignored`)
  }
})

test('safe deployment templates and migrations remain available in GitHub ZIPs', async () => {
  const requiredPaths = [
    '.env.example',
    'README.md',
    'SECURE_DEPLOYMENT.md',
    'prisma/schema.prisma',
    'prisma/migrations/20260730_auth_audit_logging/migration.sql'
  ]
  const ignored = await checkIgnored(requiredPaths)

  for (const file of requiredPaths) {
    assert.equal(ignored.has(file), false, `${file} must remain available`)
  }
})
