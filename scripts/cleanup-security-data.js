const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const retentionDays = Math.max(
    30,
    Number.parseInt(process.env.LOG_RETENTION_DAYS || "365", 10) || 365,
  );
  const now = new Date();
  const attemptsBefore = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const auditBefore = new Date(
    now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
  );

  const [sessions, attempts, auditLogs] = await prisma.$transaction([
    prisma.auth_sessions.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: now } },
          { revoked_at: { lt: attemptsBefore } },
        ],
      },
    }),
    prisma.login_attempts.deleteMany({
      where: { attempted_at: { lt: attemptsBefore } },
    }),
    prisma.audit_logs.deleteMany({
      where: { occurred_at: { lt: auditBefore } },
    }),
  ]);

  console.log(
    JSON.stringify({
      timestamp: now.toISOString(),
      event: "security_data_cleanup",
      deleted: {
        sessions: sessions.count,
        loginAttempts: attempts.count,
        auditLogs: auditLogs.count,
      },
      auditRetentionDays: retentionDays,
    }),
  );
}

main()
  .catch((error) => {
    console.error(`Cleanup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

