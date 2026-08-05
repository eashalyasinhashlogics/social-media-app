import { create } from 'zustand'
import { conversationsAPI, notificationsAPI } from '@/lib/api'
import { subscribeUnreadChanged } from '@/lib/unreadEvents'

interface UnreadStore {
  messagesUnread: number
  notificationsUnread: number
  refreshMessages: () => Promise<void>
  refreshNotifications: () => Promise<void>
}

// Root cause of "the badge only clears after a full reload": AppNavbar and
// the messages page each independently called `conversationsAPI.list()` and
// kept the result in their *own* local `useState`. Reading a message updates
// the count on the server immediately, but there was no shared state for the
// navbar's copy to be told about - it could only find out on its own next
// 20s poll (or never, if something about that poll silently failed). A
// hand-rolled pub/sub on top of that (subscribeUnreadChanged) fixed it in
// principle, but it's an extra custom mechanism with its own ways to be
// mis-wired.
//
// This replaces both local `useState`s with one Zustand store - the same
// pattern `authStore` already uses elsewhere in this app. Whoever changes
// read-state calls `refreshMessages()` directly on this store; every
// component reading `messagesUnread` via the hook re-renders automatically
// because that's just how Zustand's subscription works, not because
// something remembered to emit an event.
export const useUnreadStore = create<UnreadStore>((set) => ({
  messagesUnread: 0,
  notificationsUnread: 0,

  refreshMessages: async () => {
    try {
      const res = await conversationsAPI.list()
      set({ messagesUnread: res.data.reduce((sum, c) => sum + c.unread_count, 0) })
    } catch {
      // Leave the last known value on the screen rather than flashing to 0
      // on a transient network error.
    }
  },

  refreshNotifications: async () => {
    try {
      const res = await notificationsAPI.unreadCount()
      set({ notificationsUnread: res.data.unread_count })
    } catch {
      // Same reasoning as above.
    }
  },
}))

// Subscribed once, at module load, rather than from a component's
// useEffect - this is what actually closes the bug. The previous fix asked
// AppNavbar to subscribe itself, which works only for as long as AppNavbar
// is mounted with a correctly-set-up effect; this subscription exists for
// the lifetime of the page load and doesn't depend on any component's
// mount/unmount timing at all. Anywhere in the app that successfully calls
// conversationsAPI.markRead now updates every consumer of this store,
// automatically, with no further wiring required.
subscribeUnreadChanged(() => {
  useUnreadStore.getState().refreshMessages()
})