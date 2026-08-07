"use client";

import { useRouter } from "next/navigation";

/**
 * Table row that navigates to href on click, except when the click lands on a
 * link or button (e.g. Convert to PO, Delete) inside the row.
 */
export function PrTableRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
