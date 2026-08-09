import React, { Suspense } from "react";
import { validatePoPortalToken } from "@/app/portal/actions";
import { PoSignForm } from "@/components/portal/po-sign-form";
import { ShieldAlert, LogIn, ArrowRight, CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { token: "sample-token" } }],
};

interface PageProps {
  params: Promise<{ token: string }>;
}

function formatAmount(amount: number | null | undefined, currency: string) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "PHP",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export default function PortalPoSignPage({ params }: PageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#020b06] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500 animate-pulse">Loading secure signature portal...</p>
        </div>
      </div>
    }>
      <PortalPoSignContent params={params} />
    </Suspense>
  );
}

async function PortalPoSignContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await validatePoPortalToken(token);

  if (result.error || !result.success || !result.po) {
    return (
      <div className="min-h-screen bg-[#020b06] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 opacity-20 blur-3xl w-96 h-96 bg-red-800 rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 opacity-20 blur-3xl w-96 h-96 bg-emerald-800 rounded-full" />

        <div className="max-w-md w-full bg-[#071F15] border border-red-950 rounded-3xl p-8 text-center relative z-10 shadow-2xl">
          <div className="h-16 w-16 rounded-2xl bg-red-950/30 border border-red-800/30 flex items-center justify-center text-red-500 mx-auto mb-6">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-plus-jakarta mb-2">
            Access Expired or Invalid
          </h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            The secure signature link you used is either invalid or has expired. Please request a new link from your TelcoVantage point of contact.
          </p>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-2xl py-3 font-semibold transition-all hover:shadow-lg hover:shadow-emerald-950/20 active:scale-95"
          >
            <LogIn className="h-5 w-5" />
            Staff Login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="text-[10px] text-emerald-900 mt-12 uppercase tracking-widest font-semibold">
          TelcoVantage Philippines Operational Security
        </p>
      </div>
    );
  }

  const po = result.po as any;
  const vendor = result.vendor as { name?: string; contact_person?: string | null } | null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020b06] py-12 transition-colors duration-500">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-br from-[#041A10] to-[#072F1C] p-6 md:p-8 text-white relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 blur-3xl w-96 h-96 bg-primary rounded-full" />
            <span className="relative z-10 bg-emerald-800/60 border border-emerald-700/50 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
              Purchase Order Signature
            </span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-plus-jakarta mt-3 relative z-10">
              {po.po_number}
            </h1>
            <p className="text-sm text-emerald-300/80 mt-1 relative z-10">
              {vendor?.name || "Vendor"} · {po.amount != null ? formatAmount(po.amount, po.currency || "PHP") : ""}
            </p>
          </div>

          {/* Body */}
          <div className="p-6 md:p-8">
            {result.alreadySigned ? (
              <div className="text-center py-8">
                <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white font-plus-jakarta">
                  This Purchase Order Has Been Signed
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
                  Signed by <span className="font-semibold">{result.signature?.signer_name}</span>
                  {result.signature?.signer_title ? `, ${result.signature.signer_title}` : ""}
                  {result.signature?.signed_at
                    ? ` on ${new Date(result.signature.signed_at).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" })}`
                    : ""}.
                  {po.status === "pending_signature" ? " You may sign again to re-confirm." : ""}
                </p>
                {result.signature?.signed_file_url && (
                  <a
                    href={result.signature.signed_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-6 bg-emerald-700 hover:bg-emerald-600 text-white rounded-2xl px-6 py-3 font-semibold transition-all active:scale-95"
                  >
                    <FileText className="h-5 w-5" /> Download Signed PO
                  </a>
                )}
                {po.status === "pending_signature" && <PoSignForm token={token} className="mt-6" />}
              </div>
            ) : (
              <PoSignForm token={token} />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          Your signature is captured electronically with your IP address and timestamp for audit purposes.
        </p>
      </div>
    </div>
  );
}
