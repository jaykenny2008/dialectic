// Runs in the extension's isolated world. Once the page shows interest in
// gamepads (see gamepad.js), connect to the controller server on this Mac and
// pass every state update to the page.
(() => {
  const URL = 'ws://127.0.0.1:8080/gamepad';
  let started = false;
  let retryMs = 1000;

  const toPage = (s) => window.postMessage({ __phonepad: 'state', s }, '*');

  function connect() {
    const ws = new WebSocket(URL);
    ws.onopen = () => { retryMs = 1000; };
    ws.onmessage = (e) => toPage(JSON.parse(e.data));
    ws.onclose = () => {
      toPage({ c: 0 });
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 10000);
    };
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__phonepad !== 'want' || started) return;
    started = true;
    connect();
  });
})();
