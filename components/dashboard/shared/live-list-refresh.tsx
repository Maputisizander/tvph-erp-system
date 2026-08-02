"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// Refreshes the list whenever PO/PR rows change anywhere in the system
// (submit for approval, approve, reject, convert). Mirrors the notification
// bell's realtime pattern. Renders nothing.
export function LiveListRefresh() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("purchase-list-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "purchase_orders" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "purchase_orders" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "purchase_orders" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "purchase_requests" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "purchase_requests" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "purchase_requests" },
        () => refresh(),
      )
      .subscribe();

    function refresh() {
      // Coalesce bursts (e.g. PR->PO conversion touching both tables) into one refresh.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), 300);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
