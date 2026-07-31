"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { updatePOCcEmails } from "@/app/dashboard/purchase-orders/actions";
import { createClient } from "@/utils/supabase/client";

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export function PoCcRecipients({
  poId,
  initialEmails,
}: {
  poId: string;
  initialEmails: string[];
}) {
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProfiles = useCallback(async (q: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("full_name", `%${q}%`)
      .order("full_name")
      .limit(6);
    setProfiles(data || []);
  }, []);

  useEffect(() => {
    if (query.length >= 2) {
      fetchProfiles(query);
      setShowDropdown(true);
    } else {
      setProfiles([]);
      setShowDropdown(false);
    }
  }, [query, fetchProfiles]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) return;
    if (emails.includes(normalized)) return;
    const next = [...emails, normalized];
    setEmails(next);
    setQuery("");
    setShowDropdown(false);
    persist(next);
  }

  function removeEmail(email: string) {
    const next = emails.filter((e) => e !== email);
    setEmails(next);
    persist(next);
  }

  function persist(nextEmails: string[]) {
    setError(null);
    startTransition(async () => {
      const result = await updatePOCcEmails(poId, nextEmails);
      if (result?.error) setError(result.error);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      addEmail(query);
    }
  }

  const filteredProfiles = profiles.filter(
    (p) => !emails.includes(p.email.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
          CC
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        </label>
        <div className="relative flex-1" ref={dropdownRef}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            placeholder="Add email recipients..."
            className="w-full px-3 py-1.5 text-sm bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-all"
          />
          {showDropdown && filteredProfiles.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addEmail(p.email)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-white truncate">
                      {p.full_name}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {p.email}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5 ml-9">
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md text-xs"
            >
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 ml-9">{error}</p>
      )}
    </div>
  );
}
