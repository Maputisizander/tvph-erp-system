"use client";

import { useState } from "react";

export default function PoTabbedNav({
  defaultTab,
  basePath,
  tabs,
  sections,
}: {
  defaultTab: string;
  basePath: string;
  tabs: { id: string; label: string }[];
  sections: Record<string, React.ReactNode>;
}) {
  const [active, setActive] = useState(defaultTab);

  function go(id: string) {
    setActive(id);
    // ponytail: replaceState avoids Next.js server refetch; pushState would add history but still no refetch
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${basePath}?tab=${id}`);
    }
  }

  return (
    <>
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {tabs.map((t) => (
            <a
              key={t.id}
              href={`${basePath}?tab=${t.id}`}
              onClick={(e) => {
                e.preventDefault();
                go(t.id);
              }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                active === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="py-4">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={active === t.id ? "animate-in fade-in duration-300" : "hidden"}
          >
            {sections[t.id]}
          </div>
        ))}
      </div>
    </>
  );
}
