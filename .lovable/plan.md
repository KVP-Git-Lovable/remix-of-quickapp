## Fix dashboard "Something went wrong" crash

**Cause:** Console shows `cannot add postgres_changes callbacks for realtime:notifications-changes after subscribe()`. `src/hooks/useNotifications.ts` (line 132) subscribes to a fixed channel name `'notifications-changes'`. The dashboard mounts this hook in multiple places (header bell, banner, etc.); the second mount reuses the same channel that is already subscribed, so `.on()` throws and the ErrorBoundary renders "Something went wrong". This is the same class of bug already fixed in `useLocationFeature` and `OperationsSummaryBoxes`.

**Fix:** In `src/hooks/useNotifications.ts`, change the channel name to a unique per-instance value so each hook mount gets its own channel:

```ts
const channel = supabase
  .channel(`notifications-changes-${Math.random().toString(36).slice(2)}`)
```

The existing `useEffect` cleanup already calls `supabase.removeChannel(channel)`, so no other changes are needed.

**Verification:** After the edit, reload `/dashboard` and confirm the console no longer logs the `notifications-changes` subscribe error and the page renders normally.

Approve to apply.