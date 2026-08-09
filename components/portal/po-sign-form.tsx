"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Loader2, Check } from "lucide-react";
import { signPortalPO } from "@/app/portal/actions";

export function PoSignForm({ token, className = "" }: { token: string; className?: string }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [ipAddress, setIpAddress] = useState("Unknown");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
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
    if (!file) {
      setFeedback({ ok: false, msg: "Please upload the signed purchase order PDF." });
      return;
    }
    if (file.type !== "application/pdf") {
      setFeedback({ ok: false, msg: "Only PDF files are accepted." });
      return;
    }
    startTransition(async () => {
      const result = await signPortalPO(token, name, title, ipAddress, file);
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
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
          Signed Purchase Order PDF <span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept="application/pdf,.pdf"
          required
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            setFileError(f && f.type !== "application/pdf" ? "Only PDF files are accepted." : null);
          }}
          className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-white file:font-semibold hover:file:bg-emerald-600"
        />
        {file && !fileError && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Selected: {file.name}</p>
        )}
        {fileError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fileError}</p>}
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
