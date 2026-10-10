# iPhone Controller

Turn your iPhone into a game controller for browser games on your Mac. No app to install on the phone: it's a web page served by your Mac over Wi-Fi.

```
iPhone (Safari)  --Wi-Fi-->  Mac: node server.js  -->  real key presses  -->  your browser game
```

Every button on the phone presses a real keyboard key on the Mac, so it works with **any browser game that uses the keyboard**: arrow keys, WASD, Space, Z/X, and so on.

## One-time setup (Mac)

1. **Install Node.js** from https://nodejs.org (or `brew install node`).
2. In Terminal, go to this folder and install:
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

## No Wi-Fi? Online mode

Some iPhone hotspots don't let the phone reach the Mac directly. You can tell when Terminal shows a link starting with `http://192.0.0.` and Safari says the iPhone is "not connected to the internet". In that case run:

```
npm run online
```

This opens a free tunnel through [localhost.run](https://localhost.run) using `ssh`, which is built into macOS, so there's nothing to install. Scan the new `https://` QR code and play. Things to know:

- It adds a little lag, and button presses use a small amount of cellular data.
- You get a new link each time, so Home Screen shortcuts won't carry over between runs.
- The link works from anywhere on the internet, but only with the secret code at the end. Don't share it, and press Ctrl+C when you're done playing.

## Real gamepad mode (analog sticks) — the default

The phone shows up in the game as an **Xbox-style controller with analog sticks**: half a push is half a push. Games that support controllers switch to their controller mode on their own. This needs a small Chrome extension on the Mac, installed once:

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `iphone-controller/chrome-extension` folder.
4. Reload your game's tab.

Then start the server (`npm start` or `npm run online`), open the controller on your phone and play. Terminal prints "Game page connected" when the game is picking it up. If Chrome asks to let the site access devices on your local network, click **Allow**: that's the extension talking to the controller server on your own Mac.

Works in Chrome and other Chrome-based browsers (Edge, Brave, Arc), not Safari. The extension only connects on pages that look for a gamepad, and it expects the server on its default port (8080).

| Phone | Gamepad |
|---|---|
| Left / right stick | Left / right analog stick |
| A / B / X / Y | A / B / X / Y |
| LB / RB, LT / RT | Bumpers, triggers |
| Back / Start | Back (View) / Start (Menu) |

## Key-based modes

For games without controller support, tap ⚙️ on the phone and pick a **Keys** preset. Each button then presses a real key on the Mac (this needs the Accessibility permission from the setup steps):

- **Keys: dual sticks**: left stick = W A S D, right stick = arrow keys, A/B/X/Y = Space/E/Q/R, LB/RB = Z/X, LT/RT = Shift/C, Start/Back = Esc/Tab.
- **D-pad** presets: Arrows + Space, WASD + Space, or Retro Z/X.

You can remap any button or stick direction to any key, or turn off diagonals. Settings are saved on the phone.

Each stick re-centres wherever your thumb lands, so you don't have to hit the exact middle. You can hold several buttons at once and slide between buttons. If the phone locks or drops off the network, every key and stick is released within a few seconds, so nothing stays stuck.

## Troubleshooting

- **Phone can't open the page:** make sure both devices are on the same Wi-Fi (not guest Wi-Fi), and allow incoming connections for `node` in **System Settings → Network → Firewall → Options**. Some public or office networks block devices from talking to each other. If that happens, turn on your iPhone's Personal Hotspot and connect the Mac to it.
- **Gamepad mode: the game ignores the controller:** make sure the extension is on in `chrome://extensions`, reload the game tab and check that Terminal says "Game page connected". Some games only notice a controller after you press a button.
- **Key mode: phone connects but nothing happens in the game:** click inside the game on the Mac first. Check that Terminal is switched on under Accessibility, and that you restarted Terminal after enabling it.
- **"Old link: rescan the QR code":** the link is protected by a secret code saved in `.token`. Scan the QR code again. To lock out every old link, delete `.token` and restart.
- **Try it without pressing real keys:** `npm run dry` prints the button presses in Terminal instead of sending them.
- **Use a different port:** `PORT=9000 npm start`

## Files

- `server.js`: serves the page and turns phone input into key presses
- `public/index.html`: the controller page your iPhone opens
- `chrome-extension/`: makes the phone appear as a real gamepad to browser games
- `keys.js`: tiny helper that sends the key events using automation tools built into macOS (nothing to install)
