const cron = require('node-cron');
const { runBackup } = require('./db-backup');

console.log(`[${new Date().toISOString()}] Database Backup Service Started`);
console.log('Cron schedule: "0 0 * * *" (Every day at 12:00 AM)');

// Schedule the backup to run at 12:00 AM every day
cron.schedule('0 0 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Executing scheduled database backup...`);
  try {
    await runBackup();
    console.log(`[${new Date().toISOString()}] Scheduled database backup completed.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Scheduled database backup failed:`, err);
  }
});
