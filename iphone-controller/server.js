// iPhone -> Mac game controller bridge.
//
// Serves a touch controller page to your phone and turns its button presses
// into real keyboard events on the Mac, so any browser game that uses the
// keyboard can be played with the phone.
//
//   node server.js           normal mode (macOS, needs Accessibility permission)
//   node server.js --dry     log key presses instead of sending them (any OS)
//   PORT=9000 node server.js use a different port

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { WebSocketServer } = require('ws');
const qrcode = require('qrcode-terminal');

const PORT = Number(process.env.PORT) || 8080;
const DRY = process.argv.includes('--dry') || process.platform !== 'darwin';
// Only phones that scanned the QR code / opened the printed URL can press keys.
// The token is kept in a file so a Home Screen shortcut keeps working across
// restarts; delete .token to revoke old links.
const TOKEN_FILE = path.join(__dirname, '.token');
const TOKEN = fs.existsSync(TOKEN_FILE)
  ? fs.readFileSync(TOKEN_FILE, 'utf8').trim()
  : crypto.randomBytes(6).toString('hex');
fs.writeFileSync(TOKEN_FILE, TOKEN);

// Key names the phone may send -> macOS virtual keycodes (kVK_* in Carbon's Events.h).
const KEYCODES = {
  ArrowUp: 0x7e, ArrowDown: 0x7d, ArrowLeft: 0x7b, ArrowRight: 0x7c,
  Space: 0x31, Enter: 0x24, Escape: 0x35, Tab: 0x30, Backspace: 0x33,
  Shift: 0x38, Control: 0x3b, Option: 0x3a,
  a: 0x00, b: 0x0b, c: 0x08, d: 0x02, e: 0x0e, f: 0x03, g: 0x05, h: 0x04,
  i: 0x22, j: 0x26, k: 0x28, l: 0x25, m: 0x2e, n: 0x2d, o: 0x1f, p: 0x23,
  q: 0x0c, r: 0x0f, s: 0x01, t: 0x11, u: 0x20, v: 0x09, w: 0x0d, x: 0x07,
  y: 0x10, z: 0x06,
  0: 0x1d, 1: 0x12, 2: 0x13, 3: 0x14, 4: 0x15, 5: 0x17, 6: 0x16, 7: 0x1a,
  8: 0x1c, 9: 0x19,
  Comma: 0x2b, Period: 0x2f, Slash: 0x2c, Semicolon: 0x29, Minus: 0x1b, Equal: 0x18,
};

// ---------------------------------------------------------------------------
// Key injection
// ---------------------------------------------------------------------------

function startKeyHelper() {
  if (DRY) return null;

  const src = path.join(__dirname, 'keys.swift');
  const bin = path.join(__dirname, '.keys-helper');
  const stale = !fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(src).mtimeMs;
  if (stale) {
    console.log('Compiling key helper (first run only)...');
    const res = spawnSync('swiftc', ['-O', src, '-o', bin], { stdio: 'inherit' });
    if (res.error || res.status !== 0) {
      console.error('\nCould not compile keys.swift. Install the Xcode command line tools with:');
      console.error('  xcode-select --install\nthen run this again.');
      process.exit(1);
    }
  }

  const helper = spawn(bin, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  helper.stdout.on('data', (buf) => {
    if (buf.toString().includes('NO_ACCESSIBILITY')) {
      console.log('\n⚠️  Key presses are blocked until you allow this terminal app in');
      console.log('   System Settings > Privacy & Security > Accessibility,');
      console.log('   then quit the terminal app completely and run `npm start` again.\n');
    }
  });
  helper.on('exit', (code) => {
    console.error(`Key helper exited (code ${code}).`);
    process.exit(1);
  });
  return helper;
}

const helper = startKeyHelper();

function sendKey(name, down) {
  const code = KEYCODES[name];
  if (code === undefined) return;
  if (DRY) {
    console.log(`${down ? '▼' : '▲'} ${name}`);
  } else {
    helper.stdin.write(`${down ? 'd' : 'u'} ${code}\n`);
  }
}

// ---------------------------------------------------------------------------
// HTTP: serve the controller page
// ---------------------------------------------------------------------------

const page = path.join(__dirname, 'public', 'index.html');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(page).pipe(res);
  } else {
    res.writeHead(404).end('Not found');
  }
});

// ---------------------------------------------------------------------------
// WebSocket: receive button presses
// ---------------------------------------------------------------------------
//
// Messages from the phone are JSON: {"t":"d","k":"Space"} (down),
// {"t":"u","k":"Space"} (up), {"t":"reset"} (release everything).

const wss = new WebSocketServer({ server });
// How many connected phones are currently holding each key, so two players
// sharing a key don't release it out from under each other.
const holders = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  if (url.searchParams.get('k') !== TOKEN) {
    ws.close(4001, 'bad token');
    return;
  }

  const held = new Set();
  const who = req.socket.remoteAddress.replace('::ffff:', '');
  console.log(`📱 Controller connected (${who})`);

  const press = (key) => {
    if (held.has(key) || !(key in KEYCODES)) return;
    held.add(key);
    const n = holders.get(key) || 0;
    holders.set(key, n + 1);
    if (n === 0) sendKey(key, true);
  };
  const release = (key) => {
    if (!held.delete(key)) return;
    const n = holders.get(key) - 1;
    holders.set(key, n);
    if (n === 0) sendKey(key, false);
  };
  const releaseAll = () => [...held].forEach(release);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.t === 'd') press(msg.k);
    else if (msg.t === 'u') release(msg.k);
    else if (msg.t === 'reset') releaseAll();
    else if (msg.t === 'ping') ws.send(JSON.stringify({ t: 'pong', id: msg.id }));
  });

  // Never leave keys stuck down if the phone locks, sleeps or drops off Wi-Fi.
  ws.on('close', () => {
    releaseAll();
    console.log(`📴 Controller disconnected (${who})`);
  });
});

// Drop phones that silently vanished (e.g. screen locked) within ~4 seconds.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 2000);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

function lanAddress() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) candidates.push({ name, address: a.address });
    }
  }
  // Prefer the Mac's Wi-Fi (en0) over VPNs, bridges, etc.
  candidates.sort((a, b) => (a.name === 'en0' ? -1 : b.name === 'en0' ? 1 : 0));
  return candidates[0] ? candidates[0].address : 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const url = `http://${lanAddress()}:${PORT}/?k=${TOKEN}`;
  console.log('\n🎮 iPhone controller is running.\n');
  console.log('Scan this with your iPhone camera (same Wi-Fi as this Mac):\n');
  qrcode.generate(url, { small: true });
  console.log(`\nOr open: ${url}\n`);
  if (DRY) console.log('(dry run: key presses are printed here, not sent to the Mac)\n');
  console.log('Then click into your browser game on the Mac so it has keyboard focus.\n');
});

process.on('SIGINT', () => {
  for (const [key, n] of holders) if (n > 0) sendKey(key, false);
  if (!helper) process.exit(0);
  helper.removeAllListeners('exit');
  helper.on('exit', () => process.exit(0));
  helper.stdin.end(); // helper flushes the key-ups, sees EOF and exits
});
