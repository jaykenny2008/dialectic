// Tiny helper that turns lines on stdin into real macOS key presses.
//   "d 49"  -> key down for virtual keycode 49 (space)
//   "u 49"  -> key up
// The terminal app running it needs Accessibility permission
// (System Settings > Privacy & Security > Accessibility).
import Foundation
import CoreGraphics
import ApplicationServices

setvbuf(stdout, nil, _IONBF, 0)

let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
if !AXIsProcessTrustedWithOptions([promptKey: true] as CFDictionary) {
    print("NO_ACCESSIBILITY")
} else {
    print("READY")
}

let source = CGEventSource(stateID: .hidSystemState)

while let line = readLine() {
    let parts = line.split(separator: " ")
    guard parts.count == 2, let code = CGKeyCode(parts[1]) else { continue }
    let down = parts[0] == "d"
    if let event = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: down) {
        event.post(tap: .cghidEventTap)
    }
}
