"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function TableTransition({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [displayKey, setDisplayKey] = useState(searchParams.toString());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const next = searchParams.toString();
    if (next !== displayKey) {
      setPending(true);
      // small delay to show pending state, then swap content with animation
      const t = setTimeout(() => {
        setDisplayKey(next);
        setPending(false);
      }, 120);
      return () => clearTimeout(t);
    }
  }, [searchParams, displayKey]);

  return (
    <div className="relative">
      {pending && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/30 overflow-hidden z-10">
          <div className="h-full w-1/3 bg-primary animate-[shimmer_800ms_ease-in-out_infinite]" style={{ animation: "shimmer 0.8s ease-in-out infinite" }} />
        </div>
      )}
      <div
        key={displayKey}
        className={`transition-opacity duration-200 ${pending ? "opacity-50" : "opacity-100"} animate-in fade-in slide-in-from-bottom-1 duration-300`}
      >
        {children}
      </div>
      <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
    </div>
  );
}
