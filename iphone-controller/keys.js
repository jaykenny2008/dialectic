// Tiny helper that turns lines on stdin into real macOS key presses.
// Runs with the JavaScript for Automation engine built into every Mac:
//   osascript -l JavaScript keys.js
//   "d 49"  -> key down for virtual keycode 49 (space)
//   "u 49"  -> key up
// The terminal app running it needs Accessibility permission
// (System Settings > Privacy & Security > Accessibility).
ObjC.import('Cocoa');

function run() {
  const stdin = $.NSFileHandle.fileHandleWithStandardInput;
  const stdout = $.NSFileHandle.fileHandleWithStandardOutput;
  const say = (s) => stdout.writeData($(s + '\n').dataUsingEncoding($.NSUTF8StringEncoding));

  let trusted = true;
  try {
    ObjC.import('ApplicationServices');
    trusted = !!$.AXIsProcessTrusted();
  } catch (e) {}
  say(trusted ? 'READY' : 'NO_ACCESSIBILITY');

  const HID_EVENT_TAP = 0; // kCGHIDEventTap
  let buf = '';
  for (;;) {
    const data = stdin.availableData; // blocks until the server sends something
    if (data.length === 0) break; // server closed the pipe
    buf += $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const [type, code] = buf.slice(0, nl).split(' ');
      buf = buf.slice(nl + 1);
      const keyCode = parseInt(code, 10);
      if (isNaN(keyCode)) continue;
      $.CGEventPost(HID_EVENT_TAP, $.CGEventCreateKeyboardEvent(null, keyCode, type === 'd'));
    }
  }
}
