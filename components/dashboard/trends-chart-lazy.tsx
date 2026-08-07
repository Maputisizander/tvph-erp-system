"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { MonthlyTrendPoint } from "@/lib/dashboard/queries";

const TrendsChart = dynamic(
  () => import("./trends-chart").then((m) => ({ default: m.TrendsChart })),
  { ssr: false }
);

export function TrendsChartLazy({ data }: { data: MonthlyTrendPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ height: 200 }}>
      {visible && <TrendsChart data={data} />}
    </div>
  );
}
