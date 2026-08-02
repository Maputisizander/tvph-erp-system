"use client";

import { useActionState, useState, useCallback, useMemo, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Building2,
  Calendar,
  CircleDollarSign,
  FileText,
  FolderGit2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  Trash2,
  MapPin,
  ArrowLeft,
  UploadCloud,
  FileSpreadsheet,
} from "lucide-react";
import { createPurchaseOrder, fetchStagedPoFile } from "@/app/dashboard/purchase-orders/actions";
import { hasCapability } from "@/lib/auth/roles";
import { Combobox } from "@/components/ui/combobox";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "sonner";
import {
  type PurchaseRequest,
  type Vendor,
  type LineItem,
  type SiteDetail,
  EMPTY_LINE_ITEM,
  EMPTY_SITE,
  type PRPrefill,
} from "@/types/purchase-orders";

export function CreatePOForm({
  vendors,
  projects,
  userRole,
  purchaseRequest,
  regions,
  areaByRegion,
}: {
  vendors: Vendor[];
  projects: { id: string; name: string }[];
  userRole: string;
  purchaseRequest?: PRPrefill | null;
  regions: string[];
  areaByRegion: Record<string, string[]>;
}) {
  const [state, formAction, isPending] = useActionState(createPurchaseOrder, null);
  const router = useRouter();
  const [selectedVendor, setSelectedVendor] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>(
    purchaseRequest?.line_items?.length ? purchaseRequest.line_items : [{ ...EMPTY_LINE_ITEM }]
  );
  const [siteDetails, setSiteDetails] = useState<SiteDetail[]>(
    purchaseRequest?.site_details?.length
      ? purchaseRequest.site_details
      : [{ ...EMPTY_SITE }]
  );
  const [waiveRequirements, setWaiveRequirements] = useState(false);
  const [resultModal, setResultModal] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    poUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      setResultModal({
        type: "success",
        title: "Purchase Order Created",
        message: state.message ?? "The purchase order was created successfully.",
        poUrl: state.poUrl,
      });
    } else {
      setResultModal({
        type: "error",
        title: "Failed to Create Purchase Order",
        message: state.message ?? "An unexpected error occurred while creating the purchase order.",
      });
    }
  }, [state]);

  useEffect(() => {
    if (state?.success) {
      if (state.poUrl) {
        router.push(state.poUrl);
      } else {
        router.push("/dashboard/purchase-orders");
      }
    }
  }, [state?.success, state?.poUrl, router]);

  const isProjectOwner = hasCapability(userRole, "po:create");

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string) => {
    setLineItems((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, [field]: value } : item));
      if (field === "category") {
        next[index] = { ...next[index], description: "" };
      }
      return next;
    });
  };

  const handleSiteChange = (index: number, field: keyof SiteDetail, value: string) => {
    setSiteDetails((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleAddLineItem = () => setLineItems((prev) => [...prev, { ...EMPTY_LINE_ITEM }]);
  const handleRemoveLineItem = (index: number) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const handleAddSite = () => setSiteDetails((prev) => [...prev, { ...EMPTY_SITE }]);
  const handleRemoveSite = (index: number) =>
    setSiteDetails((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const handleSubmit = (event: React.FormEvent) => {
    const form = event.currentTarget;
    const vendorId = (form.elements.namedItem("vendor_id") as HTMLSelectElement)?.value;
    if (!vendorId) {
      event.preventDefault();
      toast.error("Please select a vendor.");
      return;
    }
    const fileInput = form.elements.namedItem("attachment") as HTMLInputElement;
    if (fileInput?.files?.length && !(fileInput.files[0].type === "application/pdf" || fileInput.files[0].type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
      event.preventDefault();
      toast.error("Attachment must be a PDF or Excel file.");
      return;
    }
    const required: { name: string; label: string }[] = [
      { name: "vendor_id", label: "Vendor" },
      { name: "project_id", label: "Project" },
      { name: "po_number", label: "PO Number" },
      { name: "po_date", label: "PO Date" },
      { name: "payment_terms", label: "Payment Terms" },
    ];
    for (const field of required) {
      const value = (form.elements.namedItem(field.name) as HTMLInputElement)?.value;
      if (!value) {
        event.preventDefault();
        toast.error(`Please fill out the ${field.label} field.`);
        return;
      }
    }
    const deliveryDate = (form.elements.namedItem("delivery_date") as HTMLInputElement)?.value;
    if (deliveryDate && new Date(deliveryDate) < new Date()) {
      event.preventDefault();
      toast.error("Delivery date cannot be in the past.");
      return;
    }
  };

  const handleFileChange = (file: File) => {
    if (!file) return;
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF or Excel file.");
      return;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File must be 10MB or smaller.");
      return;
    }
    toast.success("Attachment staged");
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF or Excel file.");
      return;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File must be 10MB or smaller.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/purchase-orders/stage-file", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success("File staged");
    } catch {
      toast.error("Upload failed. Please try again.");
    }
  };

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-8"
    >
      {/* Vendor Selection */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Vendor</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="vendor_id" className="block text-sm font-medium text-gray-700">
              Vendor
            </label>
            <select
              id="vendor_id"
              name="vendor_id"
              required
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="project_id" className="text-sm font-medium text-gray-700">
              Project
            </label>
            <select
              id="project_id"
              name="project_id"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* PO Details */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">PO Details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="po_number" className="block text-sm font-medium text-gray-700">
              PO Number
            </label>
            <input
              id="po_number"
              name="po_number"
              type="text"
              required
              placeholder="e.g. PO-2025-001"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="po_date" className="text-sm font-medium text-gray-700">
              PO Date
            </label>
            <input
              id="po_date"
              name="po_date"
              type="date"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="delivery_date" className="text-sm font-medium text-gray-700">
              Delivery Date
            </label>
            <input
              id="delivery_date"
              name="delivery_date"
              type="date"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="payment_terms" className="text-sm font-medium text-gray-700">
              Payment Terms
            </label>
            <input
              id="payment_terms"
              name="payment_terms"
              type="text"
              required
              placeholder="e.g. Net 30"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Line Items */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
        <div className="mt-4 space-y-4">
          {lineItems.map((item, index) => (
            <div key={index} className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Item Description</label>
                <input
                  name={`items[${index}][description]`}
                  defaultValue={item.description}
                  onChange={(e) => handleLineItemChange(index, "description", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Qty</label>
                <input
                  name={`items[${index}][qty]`}
                  type="number"
                  defaultValue={item.qty}
                  onChange={(e) => handleLineItemChange(index, "qty", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Unit</label>
                <input
                  name={`items[${index}][unit]`}
                  defaultValue={item.unit}
                  onChange={(e) => handleLineItemChange(index, "unit", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  name={`items[${index}][category]`}
                  defaultValue={item.category}
                  onChange={(e) => handleLineItemChange(index, "category", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Services">Services</option>
                  <option value="Software">Software</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Cost</label>
                <input
                  name={`items[${index}][cost]`}
                  type="number"
                  step="0.01"
                  defaultValue={item.cost}
                  onChange={(e) => handleLineItemChange(index, "cost", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {lineItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveLineItem(index)}
                  className="self-end text-red-500 hover:text-red-700"
                  aria-label="Remove line item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddLineItem}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Add Line Item
          </button>
        </div>
      </section>

      {/* Site Details */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Site Details</h2>
        <div className="mt-4 space-y-4">
          {siteDetails.map((site, index) => (
            <div key={index} className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Site Name</label>
                <input
                  name={`sites[${index}][name]`}
                  defaultValue={site.name}
                  onChange={(e) => handleSiteChange(index, "name", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  name={`sites[${index}][address]`}
                  defaultValue={site.address}
                  onChange={(e) => handleSiteChange(index, "address", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Region</label>
                <input
                  name={`sites[${index}][region]`}
                  defaultValue={site.region}
                  onChange={(e) => handleSiteChange(index, "region", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input
                  name={`sites[${index}][city]`}
                  defaultValue={site.city}
                  onChange={(e) => handleSiteChange(index, "city", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                <input
                  name={`sites[${index}][contact_person]`}
                  defaultValue={site.contact_person}
                  onChange={(e) => handleSiteChange(index, "contact_person", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                <input
                  name={`sites[${index}][contact_number]`}
                  defaultValue={site.contact_number}
                  onChange={(e) => handleSiteChange(index, "contact_number", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {siteDetails.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveSite(index)}
                  className="self-end text-red-500 hover:text-red-700"
                  aria-label="Remove site"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddSite}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Add Site
          </button>
        </div>
      </section>

      {/* Attachment */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Attachment</h2>
        <div className="mt-4">
          <input
            type="file"
            name="attachment"
            accept=".pdf,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileChange(file);
              }
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          <FileUpload onUpload={handleUpload} />
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard/purchase-orders")}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isPending ? "Creating..." : "Create PO"}
        </button>
      </div>
    </form>
  );
}
