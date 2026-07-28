"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { Mail, X, Loader2, Search, UserPlus } from "lucide-react";
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
  const [externalInput, setExternalInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchProfiles = useCallback(async (q: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("full_name", `%${q}%`)
      .order("full_name")
      .limit(8);
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
    setExternalInput("");
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

  function handleExternalKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail(externalInput);
    }
  }

  const filteredProfiles = profiles.filter(
    (p) => !emails.includes(p.email.toLowerCase()),
  );

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> CC Recipients
        </h2>
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>
      <div className="p-6 space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          These recipients will receive a copy of the PO email sent to the vendor.
        </p>

        {/* Selected chips */}
        {emails.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {emails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-xs font-medium"
              >
                <Mail className="h-3 w-3" />
                {email}
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search internal users */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.length >= 2 && setShowDropdown(true)}
                placeholder="Search internal users..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>
          {showDropdown && filteredProfiles.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {filteredProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addEmail(p.email)}
                  className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <UserPlus className="h-4 w-4 text-slate-400 shrink-0" />
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

        {/* External email input */}
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={externalInput}
            onChange={(e) => setExternalInput(e.target.value)}
            onKeyDown={handleExternalKeyDown}
            placeholder="Or type an external email address..."
            className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          <button
            type="button"
            onClick={() => addEmail(externalInput)}
            disabled={!externalInput.includes("@")}
            className="px-3 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {emails.length === 0 && (
          <p className="text-xs text-slate-400 italic">No CC recipients added yet.</p>
        )}
      </div>
    </div>
  );
}
