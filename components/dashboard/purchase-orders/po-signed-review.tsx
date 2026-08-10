"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, FileText, Loader2 } from "lucide-react";
import { reviewSignedPo } from "@/app/dashboard/purchase-orders/actions";

export function PoSignedReview({
  poId,
  signedFileUrl,
  canReview,
}: {
  poId: string;
  signedFileUrl?: string | null;
  canReview: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(decision: "approve" | "reject") {
    if (decision === "reject" && !reason.trim()) {
      setFeedback({ ok: false, msg: "Please enter a reason for rejection." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const result = await reviewSignedPo(poId, decision, reason);
      if (result?.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({
          ok: true,
          msg:
            decision === "approve"
              ? "Signed PO approved."
              : "Signed PO rejected. Resend the signature request to let the vendor re-upload.",
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Signed PO Awaiting Your Approval
        </p>
      </div>
      <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
        The vendor submitted an executed copy. Review it, then approve or reject.
      </p>
      {signedFileUrl && (
        <a
          href={signedFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-primary hover:underline"
        >
          <FileText className="h-4 w-4" /> Download signed PDF
        </a>
      )}
      {canReview && (
        <div className="mt-3 space-y-3">
          {rejecting && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection"
              rows={2}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => submit("approve")}
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve Signed PO
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => (rejecting ? submit("reject") : setRejecting(true))}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              {rejecting ? "Confirm Rejection" : "Reject"}
            </button>
          </div>
          {feedback && (
            <p className={`text-sm ${feedback.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {feedback.msg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
