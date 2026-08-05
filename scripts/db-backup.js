const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Load env vars if running standalone
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

async function runBackup() {
  console.log(`[${new Date().toISOString()}] Starting database backup process...`);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  const dbUrlStr = process.env.DATABASE_URL;
  let dbUrl;
  try {
    dbUrl = new URL(dbUrlStr);
  } catch (err) {
    throw new Error('Invalid DATABASE_URL format. It must be a valid connection string.');
  }

  const user = decodeURIComponent(dbUrl.username);
  const password = decodeURIComponent(dbUrl.password);
  const host = dbUrl.hostname || 'localhost';
  const port = dbUrl.port || '3306';
  const database = dbUrl.pathname.slice(1);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup_${database}_${timestamp}.sql`;
  const backupPath = path.join(require('os').tmpdir(), backupFileName);

  console.log(`Generating mysqldump to ${backupPath}...`);
  // Using --no-tablespaces to avoid permission issues for some MySQL users
  const mysqldumpPath = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe"`;

  const dumpCommand = `${mysqldumpPath} -h "${host}" -P ${port} -u "${user}" -p"${password}" --no-tablespaces "${database}" > "${backupPath}"`;

  try {
    await execAsync(dumpCommand);
    console.log('Database dump successful.');

    // Now send the email
    await sendEmailWithBackup(backupPath, backupFileName);
    console.log('Backup process completed successfully.');
  } catch (error) {
    console.error('Error during backup process:', error);
  } finally {
    // Clean up the backup file
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      console.log(`Cleaned up local backup file ${backupPath}.`);
    }
  }
}

async function sendEmailWithBackup(filePath, fileName) {
  const { SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_USER || !SMTP_PASS || SMTP_USER === 'your_email@example.com') {
    console.error('Email sending skipped: SMTP_USER and SMTP_PASS are not properly configured in .env');
    return;
  }

  console.log('Connecting to SMTP to send email...');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Assuming gmail, change if needed
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"DB Backup Service" <${SMTP_USER}>`,
    to: '24104048@nec.edu.in',
    subject: `Daily Database Backup: ${fileName}`,
    text: `Please find attached the daily database backup.\n\nDate: ${new Date().toLocaleString()}`,
    attachments: [
      {
        filename: fileName,
        path: filePath,
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${info.messageId}`);
  } catch (error) {
    console.error('Failed to send backup email:', error);
    throw error;
  }
}

// If this script is run directly, execute it
if (require.main === module) {
  runBackup().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runBackup };
