// Root cause of "I read the message but the navbar badge still shows 1":
// AppNavbar and the conversation page each poll GET /conversations on their
// own independent timers (every 20s for the navbar). Marking a conversation
// read updates the *server* immediately, but nothing told the navbar's
// already-running poll to re-check early - so the badge only self-corrected
// whenever its own 20s timer happened to land, which reads as "stuck" to
// anyone watching it right after reading a message.
//
// This is a minimal event bus (no new dependency, no new endpoint): whoever
// changes read-state calls `notifyUnreadChanged()`, and anyone displaying an
// unread count subscribes to be told to refetch immediately instead of
// waiting out its polling interval.
type Listener = () => void

const listeners = new Set<Listener>()

export function subscribeUnreadChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyUnreadChanged(): void {
  listeners.forEach((listener) => listener())
}