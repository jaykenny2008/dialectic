// Runs in the page itself, before the game's own scripts. Adds a virtual
// standard-layout (Xbox style) gamepad driven by the iPhone controller.
// Only pages that actually look for gamepads ever connect to the Mac.
(() => {
  const realGetGamepads = Navigator.prototype.getGamepads;
  const realAddEventListener = EventTarget.prototype.addEventListener;

  let wanted = false;
  function want() {
    if (wanted) return;
    wanted = true;
    window.postMessage({ __phonepad: 'want' }, '*');
  }

  const button = (on) => ({ pressed: on, touched: on, value: on ? 1 : 0 });
  const pad = {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    index: 0,
    connected: false,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => button(false)),
    vibrationActuator: null,
  };
  // So `pad instanceof Gamepad` holds; the own properties above shadow the
  // prototype's getters.
  try { Object.setPrototypeOf(pad, Gamepad.prototype); } catch (e) {}

  function fire(type) {
    let event;
    try {
      event = new GamepadEvent(type, { gamepad: pad });
    } catch (e) {
      // GamepadEvent only accepts real Gamepad objects.
      event = new Event(type);
      Object.defineProperty(event, 'gamepad', { value: pad });
    }
    window.dispatchEvent(event);
  }

  Navigator.prototype.getGamepads = function getGamepads() {
    want();
    const list = Array.from(realGetGamepads.call(this) || []);
    if (!pad.connected) return list;
    let slot = list.findIndex((g) => !g);
    if (slot < 0) slot = list.length;
    pad.index = slot;
    list[slot] = pad;
    return list;
  };

  // Games that wait for a "gamepadconnected" event also count as interested.
  EventTarget.prototype.addEventListener = function addEventListener(type, ...rest) {
    if (this === window && typeof type === 'string' && type.startsWith('gamepad')) want();
    return realAddEventListener.call(this, type, ...rest);
  };

  // A fast flick can arrive as "stick pushed" and "stick centred" almost
  // together (fast thumbs, network jitter). Keep each stick's last position for
  // a few frames before re-centring so the game's next poll still sees it.
  const MIN_HOLD_MS = 50;
  const lastPushed = [0, 0];
  const recentre = [null, null];

  function setSticks(axes) {
    const now = performance.now();
    const next = pad.axes.slice();
    for (const k of [0, 1]) {
      const x = axes[2 * k], y = axes[2 * k + 1];
      clearTimeout(recentre[k]);
      const wait = lastPushed[k] + MIN_HOLD_MS - now;
      if (x === 0 && y === 0 && wait > 0) {
        recentre[k] = setTimeout(() => {
          const a = pad.axes.slice();
          a[2 * k] = a[2 * k + 1] = 0;
          pad.axes = a;
          pad.timestamp = performance.now();
        }, wait);
        continue;
      }
      if (x !== 0 || y !== 0) lastPushed[k] = now;
      next[2 * k] = x;
      next[2 * k + 1] = y;
    }
    pad.axes = next;
  }

  realAddEventListener.call(window, 'message', (e) => {
    if (e.source !== window || !e.data || e.data.__phonepad !== 'state') return;
    const s = e.data.s;
    if (!s.c) {
      if (pad.connected) {
        clearTimeout(recentre[0]);
        clearTimeout(recentre[1]);
        pad.axes = [0, 0, 0, 0];
        pad.connected = false;
        fire('gamepaddisconnected');
      }
      return;
    }
    setSticks(s.a);
    pad.buttons = pad.buttons.map((_, i) => button(((s.b >>> i) & 1) === 1));
    pad.timestamp = performance.now();
    if (!pad.connected) {
      pad.connected = true;
      fire('gamepadconnected');
    }
  });
})();
