"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

type ApprovalTable = "purchase_orders" | "purchase_requests";

type ApprovalAudienceRow = {
  submitted_for_approval_by?: string | null;
  approval_requested_from?: string[] | null;
};

type DetailRow = ApprovalAudienceRow & {
  id: string;
  status?: string | null;
  po_number?: string | null;
  pr_number?: string | null;
  amount?: number | null;
  vendors?: { name?: string | null } | null;
  projects?: { name?: string | null } | null;
};

// Pure audience gate: superadmins see everything; others only their own
// submissions or rows where they were picked as an approver.
export function shouldShowApprovalToast(
  currentUserId: string,
  currentRole: string,
  row: ApprovalAudienceRow,
): boolean {
  if (currentRole === "superadmin") return true;
  if (row.submitted_for_approval_by === currentUserId) return true;
  return row.approval_requested_from?.includes(currentUserId) ?? false;
}

// Toasts when a PO/PR flips to pending_approval (submit or resubmit), but only
// to the submitter, the requested approvers, and superadmins. Renders nothing.
// Withdraw/reject-to-draft transitions change status away from pending_approval
// and are ignored. Offline users are covered by the existing bell + email.
export function ApprovalToastListener() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, { table: ApprovalTable; id: string }>>({});

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function start() {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || disposed) return;
      const uid: string = userId;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      const role: string = profile?.role ?? "user";
      if (disposed) return;

      channel = supabase
        .channel("approval-toasts")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "purchase_orders" },
          (payload) => enqueue(payload, "purchase_orders"),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "purchase_requests" },
          (payload) => enqueue(payload, "purchase_requests"),
        )
        .subscribe();

      function enqueue(
        payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
        table: ApprovalTable,
      ) {
        const record = payload.new as Record<string, unknown>;
        if (record.status !== "pending_approval") return;
        const key = `${table}-${String(record.id)}`;
        if (pendingRef.current[key]) return;
        pendingRef.current[key] = { table, id: String(record.id) };
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          const entries = Object.values(pendingRef.current);
          pendingRef.current = {};
          entries.forEach((e) => void notify(e.table, e.id));
        }, 300);
      }

      async function notify(table: ApprovalTable, id: string) {
        if (disposed) return;
        const { data: row } = await supabase
          .from(table)
          .select(
            table === "purchase_orders"
              ? "po_number, amount, status, submitted_for_approval_by, approval_requested_from, vendors(name)"
              : "pr_number, status, projects(name), submitted_for_approval_by, approval_requested_from",
          )
          .eq("id", id)
          .maybeSingle<DetailRow>();

        // Stale: approved/rejected inside the debounce window.
        if (!row || row.status !== "pending_approval") return;
        if (!shouldShowApprovalToast(uid, role, row)) return;

        const isSubmitter = row.submitted_for_approval_by === uid;
        const number = table === "purchase_orders" ? row.po_number : row.pr_number;
        const code = `#${number ?? id.slice(0, 8)}`;
        const route = table === "purchase_orders" ? "purchase-orders" : "purchase-requests";
        const detail =
          table === "purchase_orders" && row.vendors?.name
            ? `${row.vendors.name} · ₱${Number(row.amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            : row.projects?.name;

        toast.info(`${table === "purchase_orders" ? "📋 PO" : "📋 PR"} ${code} submitted for approval`, {
          description: detail
            ? `${isSubmitter ? "Awaiting your approvers" : "Requires your approval"} · ${detail}`
            : isSubmitter
              ? "Awaiting your approvers"
              : "Requires your approval",
          action: {
            label: "Review",
            onClick: () => router.push(`/dashboard/${route}/${id}`),
          },
        });
      }
    }

    void start();

    return () => {
      disposed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
