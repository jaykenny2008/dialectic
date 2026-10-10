# iPhone Controller

Turn your iPhone into a game controller for browser games on your Mac. No app to install on the phone: it's a web page served by your Mac over Wi-Fi.

```
iPhone (Safari)  --Wi-Fi-->  Mac: node server.js  -->  real key presses  -->  your browser game
```

Every button on the phone presses a real keyboard key on the Mac, so it works with **any browser game that uses the keyboard**: arrow keys, WASD, Space, Z/X, and so on.

## One-time setup (Mac)

1. **Install Node.js** from https://nodejs.org (or `brew install node`).
2. **Install Apple's command line tools**, which are needed to build the tiny key-press helper:
   ```
   xcode-select --install
   ```
   (If it says they're already installed, you're good.)
3. In Terminal, go to this folder and install:
   ```
   cd iphone-controller
   npm install
   ```

## Play

1. On the Mac, run:
   ```
   npm start
   ```
2. **First run only:** macOS asks to give Terminal *Accessibility* access. Open
   **System Settings → Privacy & Security → Accessibility**, switch **Terminal** on (or iTerm, if that's what you use),
   then quit Terminal completely (⌘Q), reopen it and run `npm start` again.
   If macOS asks whether "node" may accept incoming network connections, click **Allow**.
3. A QR code appears in Terminal. **Scan it with the iPhone camera** (your phone must be on the same Wi-Fi as your Mac). It opens the controller in Safari.
4. Turn the phone sideways.
5. On the Mac, open your game and **click inside it** so it has keyboard focus. Play.

Tip: in Safari tap **Share → Add to Home Screen**. The controller then opens full screen with no Safari bars, and the link keeps working every time you start the server.

## Controls

| Button | Default key (Arrows preset) |
|---|---|
| D-pad | Arrow keys (diagonals supported, slide your thumb around) |
| A | Space |
| B | X |
| X | Z |
| Y | C |
| L / R | Shift / V |
| Start / Select | Enter / Esc |

Tap the ⚙️ on the phone to switch presets (**Arrows + Space**, **WASD + Space**, **Retro Z/X**), remap any button to any key, or make the D-pad 4-way. Settings are saved on the phone.

You can hold several buttons at once and slide between buttons (e.g. roll from A to B). If the phone locks or drops off Wi-Fi, the Mac lets go of every key within a few seconds, so nothing stays stuck down.

## Troubleshooting

- **Phone can't open the page:** make sure both devices are on the same Wi-Fi (not guest Wi-Fi), and allow incoming connections for `node` in **System Settings → Network → Firewall → Options**. Some public or office networks block devices from talking to each other. If that happens, turn on your iPhone's Personal Hotspot and connect the Mac to it.
- **Phone connects but nothing happens in the game:** click inside the game on the Mac first. Check that Terminal is switched on under Accessibility, and that you restarted Terminal after enabling it.
- **"Old link: rescan the QR code":** the link is protected by a secret code saved in `.token`. Scan the QR code again. To lock out every old link, delete `.token` and restart.
- **Try it without pressing real keys:** `npm run dry` prints the button presses in Terminal instead of sending them.
- **Use a different port:** `PORT=9000 npm start`

## Files

- `server.js`: serves the page and turns phone input into key presses
- `public/index.html`: the controller page your iPhone opens
- `keys.swift`: tiny macOS helper that sends the key events (built automatically on first run)
