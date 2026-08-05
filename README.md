# TASK 2 — Followers / Following / Friends List Screen

## 1. Files to Change

- `src/components/FollowListModal.tsx` — rewritten: single modal with 3 tabs + per-row relationship button (was: 3 separate modals, no relationship button)
- `src/components/ProfileView.tsx` — updated to pass `userId`/`currentUserId`/`initialType` to the new modal instead of per-type fetch functions, and to refresh counts when a relationship changes inside the modal
- `src/lib/api.ts` — already fixed in Task 1 (`profileAPI.getFollowers/getFollowing/getFriends` now hit real `/users/...` routes); reused as-is here
- Backend: no changes beyond Task 1's new `/users/{user_id}/friends` route — `/followers` and `/following` already existed and needed no changes

## 2. Brief Explanation

The Followers/Following/Friends counts already opened *a* modal
(`FollowListModal`), but each stat opened a **separate** modal instance
with no way to switch tabs, and rows had no relationship button — just a
link to the profile. Rewrote the modal to own all three tabs internally
(cached per tab so switching back and forth doesn't refetch), and to
compute a relationship button per row (Follow/Following/Pending/Friends →
Unfriend-on-hover) by fetching the *viewer's* own following/friends/outgoing
lists once, reusing the exact same API calls `ProfileView` already made for
its own header button. Actions (follow/unfollow/add friend/cancel/unfriend)
update local state instantly, matching the existing convention elsewhere in
the app. No pagination was added since no page in the app currently uses
infinite scroll or "load more" (backend already supports `skip`/`limit`
generally, but the frontend convention here is a single fetch per list).

## 3. Markdown File — Full Code

### `src/components/FollowListModal.tsx` (full file, replaces the previous version)

```tsx
HEADER
cat /home/claude/final_FollowListModal.tsx
cat << 'FOOTER'
```

### `src/components/ProfileView.tsx` — changed sections only

Import line:

```tsx
import { FollowListModal, FollowListType } from '@/components/FollowListModal'
```

Replace the old per-type fetch resolvers / `listModalConfig` block with a
single counts-refresh callback (goes right before the `visiblePosts` filter):

```tsx
  // Called by the list modal whenever a follow/friend action happens
  // inside it, so this profile's own stats stay in sync without a full
  // page refresh.
  const refreshCounts = () => {
    profileAPI
      .getPublicProfile(profile.user_id)
      .then((res) => {
        setFollowerCount(res.data.follower_count)
        onProfileUpdated(res.data)
      })
      .catch(() => {})
    profileAPI
      .getFriends(profile.user_id)
      .then((res) => setFriendCount(res.data.length))
      .catch(() => {})
  }
```

Modal invocation at the bottom of the component:

```tsx
      {listModalType && (
        <FollowListModal
          userId={profile.user_id}
          currentUserId={currentUserId}
          initialType={listModalType}
          onClose={() => setListModalType(null)}
          onRelationshipChanged={refreshCounts}
        />
      )}
```

The three stat buttons (`onClick={() => setListModalType('followers'|'following'|'friends')}`)
are unchanged — they already set the same `listModalType` state that now
drives which tab opens first.

## PowerShell / npm / Git commands

```powershell
cd frontend
npm run build
```

```powershell
git add src/components/FollowListModal.tsx src/components/ProfileView.tsx
git commit -m "Task 2: tabbed Followers/Following/Friends modal with relationship buttons"
```

## Testing Checklist

- [ ] Click "followers" on a profile — modal opens on the Followers tab, showing avatar, name, @username for each follower.
- [ ] Click the "Following" tab inside the modal — list loads (only once; switching back to Followers doesn't refetch).
- [ ] Click the "Friends" tab — list loads correctly (this previously 404'd before the Task 1 fix).
- [ ] For a row that is a stranger to the viewer: shows "Follow" (primary) + a small "add friend" icon button.
- [ ] Click "Follow" on a row — button flips to "Following" instantly, no page reload.
- [ ] Click the add-friend icon on a row — button becomes "Pending"; click it again — request is cancelled and button reverts.
- [ ] For a row that is already a friend of the viewer: shows a green "Friends" pill that turns into red "Unfriend" on hover; clicking it (after the confirm dialog) removes the friendship and, if viewing your own friends tab, removes the row from the list immediately.
- [ ] For the viewer's own row (if it appears in a list, e.g. viewing your own followers): no relationship button is shown.
- [ ] Unfollow/unfriend/add-friend actions inside the modal call `onRelationshipChanged`, which silently refreshes the profile page's follower/friends counts behind the modal.
- [ ] Clicking a row (not the button) navigates to that user's profile and closes the modal.
- [ ] Open the modal as a logged-out/anonymous-context edge case is not applicable (list screen is only reachable from within the authenticated app), but confirm the underlying `/users/{id}/followers|following|friends` endpoints themselves respond without auth (used by Task 1's checklist too).
FOOTER
} 