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
  // every change of direction is shown, in order, for at least a frame or two,
  // at the strongest tilt reached in that direction; then the stick settles on
  // where the thumb really is. Updates within a settled direction pass through.
  const DWELL_MS = 34;     // ~2 frames at 60 fps
  const CATCH_UP_MS = 20;  // ~1 frame, while working through a backlog
  const MAX_QUEUE = 8;
  const entry = (sector, p) => ({ sector, peak: p, latest: p });
  const sticks = [0, 1].map(() => ({ cur: entry('c', [0, 0]), since: 0, dwell: 0, queue: [], timer: null }));
  const mag = (p) => Math.hypot(p[0], p[1]);

  function sectorOf(x, y) {
    if (Math.hypot(x, y) < 0.35) return 'c';
    return String(((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8);
  }

  function show(k, p) {
    const a = pad.axes.slice();
    a[2 * k] = p[0];
    a[2 * k + 1] = p[1];
    pad.axes = a;
    pad.timestamp = performance.now();
  }

  function pump(k) {
    const st = sticks[k];
    clearTimeout(st.timer);
    st.timer = null;
    const wait = st.since + st.dwell - performance.now();
    if (wait > 0) {
      st.timer = setTimeout(() => pump(k), wait);
      return;
    }
    if (st.queue.length) {
      st.cur = st.queue.shift();
      st.since = performance.now();
      st.dwell = st.queue.length ? CATCH_UP_MS : DWELL_MS;
      show(k, st.cur.peak);
      st.timer = setTimeout(() => pump(k), st.dwell);
    } else {
      show(k, st.cur.latest); // done showing the peak: settle on the real position
    }
  }

  function receiveStick(k, x, y) {
    const st = sticks[k];
    const p = [x, y];
    const sector = sectorOf(x, y);
    const tail = st.queue.length ? st.queue[st.queue.length - 1] : st.cur;
    if (sector === tail.sector) {
      tail.latest = p;
      if (sector === 'c' || mag(p) >= mag(tail.peak)) tail.peak = p;
      // The current direction: show stronger tilts at once; weaker ones wait
      // until its moment is over (the pending pump settles on them).
      if (tail === st.cur && (tail.peak === p || performance.now() - st.since >= st.dwell)) show(k, p);
      return;
    }
    st.queue.push(entry(sector, p));
    if (st.queue.length > MAX_QUEUE) st.queue.splice(0, st.queue.length - MAX_QUEUE);
    pump(k);
  }

  function resetSticks() {
    for (const st of sticks) {
      clearTimeout(st.timer);
      Object.assign(st, { cur: entry('c', [0, 0]), since: 0, dwell: 0, queue: [], timer: null });
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
