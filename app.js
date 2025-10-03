'use strict';

// Command path
const JWT_AGENT = '/usr/local/bin/jwt-agent';
const MOUNT_HPCI = '/usr/local/bin/mount.hpci';
const UMOUNT_HPCI = '/usr/local/bin/umount.hpci';

// Core dependencies
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

// App setup
const app = express();
const port = 3000;
const router = express.Router();
const basePath = process.env.PASSENGER_BASE_URI || '/';
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(basePath, router);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Output a timestamped log message with a consistent prefix.
function output_log(message) {
  const d = new Date().toISOString(); // UTC timestamp (Example: 2025-09-06T12:34:56.789Z)
  console.log(`[HPCI_Shared_Storage] [${d}] ${message}`);
}

// Invoke jwt-agent with HPCI credentials and then runs mount.hpci.
// Return: { ok: true, path: string } on success
router.post('/api/mount', (req, res) => {
  output_log("call /api/mount");    
  const { hpciId, passphrase } = req.body || {};
  if (!hpciId || !passphrase) {
    return res.json({ ok: false, message: 'Missing HPCI ID or passphrase' });
  }

  // Run jwt-agent
  const jwtArgs = ['-s', 'https://elpis.hpci.nii.ac.jp/', '-l', hpciId];
  const jwt = spawn(JWT_AGENT, jwtArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
  jwt.stdin.write(passphrase + '\n');
  jwt.stdin.end();

  let jwtStdout = '';
  let jwtStderr = '';
  jwt.stdout.on('data', (c) => (jwtStdout += c.toString()));
  jwt.stderr.on('data', (c) => (jwtStderr += c.toString()));

  jwt.on('close', (jwtCode) => {
    if (jwtCode !== 0) {
      const message = jwtStdout.trim() + '\n' + jwtStderr.trim();
      return res.json({ ok: false, message });
    }

    // Run mount.hpci
    const mount = spawn(MOUNT_HPCI, [], { stdio: ['ignore', 'pipe', 'pipe'] });

    let mStdout = '';
    let mStderr = '';
    mount.stdout.on('data', (c) => (mStdout += c.toString()));
    mount.stderr.on('data', (c) => (mStderr += c.toString()));

    mount.on('close', (mountCode) => {
      const output = (mStdout + '\n' + mStderr).trim();
      const match = output.match(/(\/tmp[^\s:]+)/);

      if (mountCode === 0 && match) {
        return res.json({ ok: true, path: match[1] });
      } else {
        return res.json({ ok: false, message: output });
      }
    });
  });
});

// Invoke umount.hpci to unmount the shared storage.
// Return: { ok: true } on success
router.post('/api/umount', (_req, res) => {
  output_log("call /api/umount");

  // Run umount.hpci
  const umount = spawn(UMOUNT_HPCI, [], { stdio: ['ignore', 'pipe', 'pipe'] });

  let uStdout = '';
  let uStderr = '';
  umount.stdout.on('data', (c) => (uStdout += c.toString()));
  umount.stderr.on('data', (c) => (uStderr += c.toString()));

  umount.on('close', (umountCode) => {
    if (umountCode === 0) {
      return res.json({ ok: true });
    } else {
      return res.json({ ok: false, message: (uStdout + '\n' + uStderr).trim() });
    }
  });
});

router.get('/', (_req, res) => {
  output_log("Run");
  res.render('index', { basePath });
});

app.listen(port, () => {
  console.log(`HPCI Shared Storage app listening on port ${port}`);
});
