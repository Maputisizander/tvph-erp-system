"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ponytail: single shared hook for optimistic flip+rollback on approval buttons.
// useState (not useOptimistic) so flip sticks until refresh/error - useOptimistic reverts to base false after transition.
// Success always changes the record status, so router.refresh() swaps the banner and unmounts these buttons - the
// 8s rescue timer only fires if the component is still mounted (thrown action, refresh not re-rendering), so a
// button can never stick "done". Harmless no-op if the component already unmounted.
export function useOptimisticAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimisticSuccess, setOptimisticSuccess] = useState(false);
  const rescueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function run(action: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null);
    setOptimisticSuccess(true);
    if (rescueTimer.current) clearTimeout(rescueTimer.current);
    rescueTimer.current = setTimeout(() => setOptimisticSuccess(false), 8000);
    startTransition(async () => {
      try {
        const result = await action();
        if (result?.error) {
          setOptimisticSuccess(false);
          setError(result.error);
        } else {
          router.refresh();
          // keep optimistic true until page unmounts via refresh (banner will show new status)
        }
      } catch {
        setOptimisticSuccess(false);
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return { error, setError, isPending, optimisticSuccess, run };
}
