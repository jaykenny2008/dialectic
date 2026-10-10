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

  // A fast flick (pull back, push forward, let go) can reach us as a burst of
  // updates within one game frame, especially over a tunnel. If we applied
  // them straight away the game would only ever see the last one. Instead,
  // every change of direction is shown for at least DWELL_MS, in order;
  // updates within the same direction pass through immediately.
  const DWELL_MS = 40;
  const sticks = [0, 1].map(() => ({ sector: 'c', since: 0, queue: [], timer: null }));

  function sectorOf(x, y) {
    if (Math.hypot(x, y) < 0.35) return 'c';
    return String(((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8);
  }

  function applyStick(k, x, y) {
    const a = pad.axes.slice();
    a[2 * k] = x;
    a[2 * k + 1] = y;
    pad.axes = a;
    pad.timestamp = performance.now();
  }

  function pump(k) {
    const st = sticks[k];
    clearTimeout(st.timer);
    st.timer = null;
    while (st.queue.length) {
      const wait = st.since + DWELL_MS - performance.now();
      if (wait > 0) {
        st.timer = setTimeout(() => pump(k), wait);
        return;
      }
      const [x, y, sector] = st.queue.shift();
      applyStick(k, x, y);
      st.sector = sector;
      st.since = performance.now();
    }
  }

  function receiveStick(k, x, y) {
    const st = sticks[k];
    const sector = sectorOf(x, y);
    const last = st.queue.length ? st.queue[st.queue.length - 1][2] : st.sector;
    if (sector === last) {
      if (st.queue.length) st.queue[st.queue.length - 1] = [x, y, sector];
      else applyStick(k, x, y);
      return;
    }
    st.queue.push([x, y, sector]);
    if (st.queue.length > 4) st.queue.splice(0, st.queue.length - 4); // never fall far behind
    pump(k);
  }

  function resetSticks() {
    for (const st of sticks) {
      clearTimeout(st.timer);
      Object.assign(st, { sector: 'c', since: 0, queue: [], timer: null });
    }
    pad.axes = [0, 0, 0, 0];
  }

  realAddEventListener.call(window, 'message', (e) => {
    if (e.source !== window || !e.data || e.data.__phonepad !== 'state') return;
    const s = e.data.s;
    if (!s.c) {
      if (pad.connected) {
        resetSticks();
        pad.connected = false;
        fire('gamepaddisconnected');
      }
      return;
    }
    receiveStick(0, s.a[0], s.a[1]);
    receiveStick(1, s.a[2], s.a[3]);
    pad.buttons = pad.buttons.map((_, i) => button(((s.b >>> i) & 1) === 1));
    pad.timestamp = performance.now();
    if (!pad.connected) {
      pad.connected = true;
      fire('gamepadconnected');
    }
  });
})();
