/** Tracks portaled floating layers (Select, etc.) so Dialog dismiss can ignore the same click. */

let openCount = 0
let closedAt = 0

export function notifyFloatingLayerOpen(open: boolean) {
  if (open) {
    openCount += 1
    return
  }
  openCount = Math.max(0, openCount - 1)
  closedAt = performance.now()
}

export function isFloatingLayerBlockingDismiss(graceMs = 300) {
  if (openCount > 0) return true
  if (typeof document !== "undefined") {
    if (
      document.querySelector("[data-slot='select-content']") ||
      document.querySelector("[data-radix-select-content]") ||
      document.querySelector("[role='listbox']")
    ) {
      return true
    }
  }
  return performance.now() - closedAt < graceMs
}
