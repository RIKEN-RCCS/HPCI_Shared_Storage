'use strict';

// Core dependencies
const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');
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

// Read command paths from config.yml, applies defaults, and verifies that
// all required binaries exist.
// 
// @return {object} Object containing verified command paths
// @throw Error if any command is missing
function getCommands() {
  // Load config.yml (fall back to empty object if missing)
  const cfg = yaml.load(fs.readFileSync('./config.yml', 'utf8')) || {};

  // Define commands with fallback defaults
  const cmds = {
    jwt_agent: cfg.jwt_agent   || '/usr/local/bin/jwt-agent',
    mount:     cfg.mount_hpci  || '/usr/local/bin/mount.hpci',
    umount:    cfg.umount_hpci || '/usr/local/bin/umount.hpci',
  };

  // Verify that each command exists
  for (const [name, cmd] of Object.entries(cmds)) {
    if (!fs.existsSync(cmd)) {
      const err = new Error(`Command not found: ${cmd} (${name})`);
      err.status = 500;
      throw err;
    }
  }

  return cmds;
}

// Output a timestamped log message with a consistent prefix.
function output_log(message) {
  const d = new Date().toISOString(); // UTC timestamp (Example: 2025-09-06T12:34:56.789Z)
  console.log(`[HPCI_Shared_Storage] [${d}] ${message}`);
}

// Invoke jwt-agent with HPCI credentials and then runs mount.hpci.
// Return: { ok: true, path: string } on success
router.post('/api/mount', (req, res) => {
  output_log("call /api/mount");    
  const { hpci_id, passphrase } = req.body || {};
  if (!hpci_id || !passphrase) {
    return res.status(400).json({ ok: false, stderr: 'Missing HPCI ID or passphrase' });
  }

  // Load & verify commands
  let CMDS;
  try {
    CMDS = getCommands();
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, stderr: err.message });
  }

  // Run jwt-agent
  const jwtArgs = ['-s', 'https://elpis.hpci.nii.ac.jp/', '-l', hpci_id];
  const jwt = spawn(CMDS.jwt_agent, jwtArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
  jwt.stdin.write(passphrase + '\n');
  jwt.stdin.end();

  let jwtStdout = '';
  let jwtStderr = '';
  jwt.stdout.on('data', (c) => (jwtStdout += c.toString()));
  jwt.stderr.on('data', (c) => (jwtStderr += c.toString()));

  jwt.on('close', (jwtCode) => {
    if (jwtCode !== 0) {
      const message = jwtStdout.trim() + '<br>' + jwtStderr.trim();
      return res.json({ ok: false, stage: CMDS.jwt_agent, code: jwtCode, stderr: message });
    }

    // Run mount.hpci
    const mount = spawn(CMDS.mount, [], { stdio: ['ignore', 'pipe', 'pipe'] });

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
        return res.json({ ok: false, stage: CMDS.mount, code: mountCode, raw: output });
      }
    });
  });
});

// Invoke umount.hpci to unmount the shared storage.
// Return: { ok: true } on success
router.post('/api/umount', (_req, res) => {
  output_log("call /api/umount");
  // Load & verify commands
  let CMDS;
  try {
    CMDS = getCommands();
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, stderr: err.message });
  }

  // Run umount.hpci
  const umount = spawn(CMDS.umount, [], { stdio: ['ignore', 'pipe', 'pipe'] });

  let uStdout = '';
  let uStderr = '';
  umount.stdout.on('data', (c) => (uStdout += c.toString()));
  umount.stderr.on('data', (c) => (uStderr += c.toString()));

  umount.on('close', (umountCode) => {
    if (umountCode === 0) {
      return res.json({ ok: true });
    }
    return res.json({ ok: false, stage: CMDS.umount, code: umountCode, raw: (uStdout + '\n' + uStderr).trim() });
  });
});

router.get('/', (_req, res) => {
  output_log("Run");
  res.render('index', { basePath });
});

app.listen(port, () => {
  console.log(`HPCI Shared Storage app listening on port ${port}`);
});
