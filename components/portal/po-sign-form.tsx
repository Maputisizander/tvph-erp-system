"use client";

import { useEffect, useState, useTransition } from "react";
import { PenLine, Loader2, Check, X } from "lucide-react";
import { signPortalPO } from "@/app/portal/actions";

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/jpg", "image/png"]);

export function PoSignForm({
  token,
  className = "",
}: {
  token: string;
  className?: string;
  signedFileUrl?: string | null;
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [ipAddress, setIpAddress] = useState("Unknown");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.ip === "string") setIpAddress(d.ip);
      })
      .catch(() => {});
  }, []);

  function validateFiles(list: File[]): string | null {
    if (list.length === 0) return null;
    const pdfs = list.filter((f) => f.type === "application/pdf");
    const images = list.filter((f) => ALLOWED_IMAGE.has(f.type));
    const unsupported = list.filter((f) => f.type !== "application/pdf" && !ALLOWED_IMAGE.has(f.type));
    if (unsupported.length > 0) return "Only PDF or JPEG/PNG images are accepted.";
    if (pdfs.length > 0 && images.length > 0) return "Please upload either a single PDF or up to 3 images, not both.";
    if (pdfs.length > 1) return "Only a single PDF file is accepted.";
    if (images.length > 3) return "Up to 3 images are accepted (the PO is 3 pages).";
    return null;
  }

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    const err = validateFiles(selected);
    setFileError(err);
    if (!err) setFiles(selected);
    else setFiles([]);
    // Reset file input on error so the same file can be re-selected after correction.
    if (err) e.target.value = "";
  }

  function removeFile(idx: number) {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    const err = validateFiles(next);
    setFileError(err);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (files.length === 0) {
      setFeedback({ ok: false, msg: "Please upload the signed purchase order (PDF or up to 3 images)." });
      return;
    }
    const err = validateFiles(files);
    if (err) {
      setFeedback({ ok: false, msg: err });
      return;
    }
    startTransition(async () => {
      const result = await signPortalPO(token, name, title, ipAddress, files);
      if (result?.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({ ok: true, msg: "Signature recorded successfully." });
      }
    });
  }

  if (feedback?.ok) {
    return (
      <div className={className ? `${className} space-y-4` : "space-y-4"}>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-6 py-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-emerald-700 flex items-center justify-center text-white">
            <Check className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-emerald-700 dark:text-emerald-400">Signature recorded successfully.</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your signed purchase order has been submitted for review. This link is now retired — if a correction is
              needed, please request a new link from your TelcoVantage contact.
            </p>
          </div>
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
          Signed Purchase Order <span className="text-red-500">*</span>
          <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">PDF or up to 3 images (JPEG/PNG)</span>
        </label>
        <input
          type="file"
          accept="application/pdf,.pdf,image/jpeg,image/png"
          multiple
          required={files.length === 0}
          onChange={handleFilesChange}
          className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-white file:font-semibold hover:file:bg-emerald-600"
        />
        {files.length > 0 && !fileError && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 text-xs"
              >
                <span className="truncate text-slate-700 dark:text-slate-300">
                  {f.name} <span className="text-slate-400">({(f.size / 1024).toFixed(0)} KB)</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length > 0 && !fileError && files.some((f) => ALLOWED_IMAGE.has(f.type)) && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {files.length} image{files.length > 1 ? "s" : ""} will be combined into a single PDF for review.
          </p>
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

      {feedback && !feedback.ok && (
        <p className="text-sm text-center text-red-600 dark:text-red-400">{feedback.msg}</p>
      )}
    </form>
  );
}
