"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Loader2, Check, FileText } from "lucide-react";
import { signPortalPO } from "@/app/portal/actions";

export function PoSignForm({
  token,
  className = "",
  signedFileUrl = null,
}: {
  token: string;
  className?: string;
  signedFileUrl?: string | null;
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [ipAddress, setIpAddress] = useState("Unknown");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [reSignMode, setReSignMode] = useState(false);
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

  // Once signed (this submit or an earlier one), show a success panel instead
  // of the inputs — unless the vendor explicitly chose to sign again.
  const showSuccess = feedback?.ok ? true : !reSignMode && !!signedFileUrl;

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

  function handleSignAgain() {
    setFeedback(null);
    setFile(null);
    setFileError(null);
    setReSignMode(true);
  }

  if (showSuccess) {
    return (
      <div className={className ? `${className} space-y-4` : "space-y-4"}>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-6 py-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-emerald-700 flex items-center justify-center text-white">
            <Check className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-emerald-700 dark:text-emerald-400">Signature recorded successfully.</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your signed purchase order has been submitted for review.
            </p>
          </div>
          {signedFileUrl && (
            <a
              href={signedFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-95"
            >
              <FileText className="h-4 w-4" /> Download Signed PO
            </a>
          )}
          <button
            type="button"
            onClick={handleSignAgain}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 underline underline-offset-4 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Sign again
          </button>
        </div>
      </div>
    );
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
        {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <PenLine className="h-5 w-5" />}
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