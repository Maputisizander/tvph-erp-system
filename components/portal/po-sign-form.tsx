"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Loader2, Check } from "lucide-react";
import { signPortalPO } from "@/app/portal/actions";

export function PoSignForm({ token, className = "" }: { token: string; className?: string }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [ipAddress, setIpAddress] = useState("Unknown");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Best-effort IP capture for the audit record; "Unknown" on failure.
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.ip === "string") setIpAddress(d.ip);
      })
      .catch(() => {});
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await signPortalPO(token, name, title, ipAddress);
      if (result?.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({ ok: true, msg: "Signature recorded successfully." });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className ? `${className} space-y-4` : "space-y-4"}>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
          Full Legal Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Juan Dela Cruz"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
          Title / Position
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Managing Director"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-2xl py-3 font-semibold transition-all hover:shadow-lg hover:shadow-emerald-950/20 active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : feedback?.ok ? (
          <Check className="h-5 w-5" />
        ) : (
          <PenLine className="h-5 w-5" />
        )}
        {isPending ? "Submitting Signature…" : "Sign Purchase Order"}
      </button>

      {feedback && (
        <p className={`text-sm text-center ${feedback.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {feedback.msg}
        </p>
      )}
    </form>
  );
}
