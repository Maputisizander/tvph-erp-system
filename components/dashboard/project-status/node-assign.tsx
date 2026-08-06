"use client";

import { useState, useTransition } from "react";
import { Unlink } from "lucide-react";
import { assignNodeToProject } from "@/app/dashboard/project-status/actions";

export function NodeAssign({
  nodeId,
  currentProjectId,
  currentProjectName,
  projects,
}: {
  nodeId: string;
  currentProjectId: string | null;
  currentProjectName: string | null;
  projects: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState(currentProjectId ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const submit = (projectId: string) => {
    startTransition(async () => {
      const result = await assignNodeToProject(nodeId, projectId || null);
      setMessage(result?.success ? "Assignment saved." : (result?.error ?? "Update failed"));
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {currentProjectName ?? (
          <span className="text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 px-2 py-0.5 rounded-full">
            Unassigned
          </span>
        )}
      </p>
      <select
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          submit(e.target.value);
        }}
        disabled={isPending}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {currentProjectId && (
        <button
          onClick={() => {
            setSelected("");
            submit("");
          }}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
        >
          <Unlink className="h-3.5 w-3.5" /> Unassign from project
        </button>
      )}
      {message && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>
      )}
    </div>
  );
}
