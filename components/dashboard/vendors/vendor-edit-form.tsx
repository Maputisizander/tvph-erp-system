"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import {
  ArrowLeft,
  Save,
  Building2,
  User,
  CreditCard,
  Plus,
  Trash2,
} from "lucide-react";
import { updateVendorProfile } from "@/app/dashboard/vendors/actions";

type VendorEditFormProps = {
  vendor: {
    id: string;
    name: string | null;
    vendor_code: string | null;
    currency: string | null;
    address: string | null;
    tin: string | null;
    contact_person: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    contact_fax: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_account_name: string | null;
    payment_terms: string | null;
    notes: string | null;
    secondary_contacts: { name: string; email: string; phone: string }[] | null;
    secondary_banking: { bank_name: string; account_name: string; account_number: string }[] | null;
  };
};

export function VendorEditForm({ vendor }: VendorEditFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateVendorProfile, null);

  const [secondaryContacts, setSecondaryContacts] = useState(
    vendor.secondary_contacts || [],
  );
  const [secondaryBanks, setSecondaryBanks] = useState(
    vendor.secondary_banking || [],
  );

  const addSecondaryContact = () =>
    setSecondaryContacts([
      ...secondaryContacts,
      { name: "", email: "", phone: "" },
    ]);
  const removeSecondaryContact = (index: number) =>
    setSecondaryContacts(secondaryContacts.filter((_, i) => i !== index));
  const updateSecondaryContact = (
    index: number,
    field: string,
    value: string,
  ) => {
    const newContacts = [...secondaryContacts];
    newContacts[index] = {
      ...newContacts[index],
      [field as keyof (typeof newContacts)[0]]: value,
    };
    setSecondaryContacts(newContacts);
  };

  const addSecondaryBank = () =>
    setSecondaryBanks([
      ...secondaryBanks,
      { bank_name: "", account_name: "", account_number: "" },
    ]);
  const removeSecondaryBank = (index: number) =>
    setSecondaryBanks(secondaryBanks.filter((_, i) => i !== index));
  const updateSecondaryBank = (index: number, field: string, value: string) => {
    const newBanks = [...secondaryBanks];
    newBanks[index] = {
      ...newBanks[index],
      [field as keyof (typeof newBanks)[0]]: value,
    };
    setSecondaryBanks(newBanks);
  };

  const inputClass =
    "w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";
  const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";
  const sectionClass =
    "bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm";
  const sectionHeaderClass =
    "px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3";

  if (state?.success) {
    router.push(`/dashboard/vendors/${vendor.id}`);
    return null;
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/vendors/${vendor.id}`}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Edit Vendor
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {vendor.name || "Untitled vendor"} — changes apply to all
            historical documents referencing this vendor.
          </p>
        </div>
      </div>

      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="id" value={vendor.id} />
        <input
          type="hidden"
          name="secondary_contacts"
          value={JSON.stringify(secondaryContacts)}
        />
        <input
          type="hidden"
          name="secondary_banking"
          value={JSON.stringify(secondaryBanks)}
        />

        {/* Company Info */}
        <div className={sectionClass}>
          <div className={sectionHeaderClass}>
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Company Information
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="name" className={labelClass}>
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={vendor.name ?? ""}
                className={inputClass}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="vendor_code" className={labelClass}>
                Vendor Code (ID) <span className="text-red-500">*</span>
              </label>
              <input
                id="vendor_code"
                name="vendor_code"
                type="text"
                required
                defaultValue={vendor.vendor_code ?? ""}
                className={inputClass}
                placeholder="e.g. VEND-001"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="address" className={labelClass}>
                Registered Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                defaultValue={vendor.address ?? ""}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tin" className={labelClass}>
                TIN (Tax Identification Number)
              </label>
              <input
                id="tin"
                name="tin"
                type="text"
                defaultValue={vendor.tin ?? ""}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className={sectionClass}>
          <div className={`${sectionHeaderClass} justify-between`}>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Contact Information
              </h2>
            </div>
            <button
              type="button"
              onClick={addSecondaryContact}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Secondary Contact
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Primary Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative pt-4">
              <div className="absolute -left-2 top-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Primary
              </div>
              <div className="space-y-2">
                <label htmlFor="contact_person" className={labelClass}>
                  Contact Person Name
                </label>
                <input
                  id="contact_person"
                  name="contact_person"
                  type="text"
                  defaultValue={vendor.contact_person ?? ""}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="contact_email" className={labelClass}>
                  Email Address
                </label>
                <input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  defaultValue={vendor.contact_email ?? ""}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="contact_phone" className={labelClass}>
                  Phone Number
                </label>
                <input
                  id="contact_phone"
                  name="contact_phone"
                  type="text"
                  defaultValue={vendor.contact_phone ?? ""}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="contact_fax" className={labelClass}>
                  Fax Number{" "}
                  <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="contact_fax"
                  name="contact_fax"
                  type="text"
                  defaultValue={vendor.contact_fax ?? ""}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Secondary Contacts */}
            {secondaryContacts.map((contact, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative"
              >
                <div className="absolute -left-2 -top-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-2">
                  Secondary #{index + 1}
                  <button
                    type="button"
                    onClick={() => removeSecondaryContact(index)}
                    className="text-red-500 hover:text-red-600 transition-colors ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Contact Person Name</label>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) =>
                      updateSecondaryContact(index, "name", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Email Address</label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) =>
                      updateSecondaryContact(index, "email", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Phone Number</label>
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={(e) =>
                      updateSecondaryContact(index, "phone", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Banking Info */}
        <div className={sectionClass}>
          <div className={`${sectionHeaderClass} justify-between`}>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Banking & Terms
              </h2>
            </div>
            <button
              type="button"
              onClick={addSecondaryBank}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Secondary Bank
            </button>
          </div>

          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative pt-4">
              <div className="absolute -left-2 top-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Primary
              </div>
              <div className="space-y-2">
                <label htmlFor="bank_name" className={labelClass}>
                  Bank Name
                </label>
                <input
                  id="bank_name"
                  name="bank_name"
                  type="text"
                  defaultValue={vendor.bank_name ?? ""}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="bank_account_name" className={labelClass}>
                  Account Name
                </label>
                <input
                  id="bank_account_name"
                  name="bank_account_name"
                  type="text"
                  defaultValue={vendor.bank_account_name ?? ""}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="bank_account_number" className={labelClass}>
                  Account Number
                </label>
                <input
                  id="bank_account_number"
                  name="bank_account_number"
                  type="text"
                  defaultValue={vendor.bank_account_number ?? ""}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="payment_terms" className={labelClass}>
                  Payment Terms
                </label>
                <input
                  id="payment_terms"
                  name="payment_terms"
                  type="text"
                  defaultValue={vendor.payment_terms ?? ""}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="currency" className={labelClass}>
                  Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue={vendor.currency || "PHP"}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="PHP">₱ PHP — Philippine Peso</option>
                  <option value="USD">$ USD — US Dollar</option>
                </select>
              </div>
            </div>

            {/* Secondary Banks */}
            {secondaryBanks.map((bank, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative"
              >
                <div className="absolute -left-2 -top-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-2">
                  Secondary #{index + 1}
                  <button
                    type="button"
                    onClick={() => removeSecondaryBank(index)}
                    className="text-red-500 hover:text-red-600 transition-colors ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Bank Name</label>
                  <input
                    type="text"
                    value={bank.bank_name}
                    onChange={(e) =>
                      updateSecondaryBank(index, "bank_name", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Account Name</label>
                  <input
                    type="text"
                    value={bank.account_name}
                    onChange={(e) =>
                      updateSecondaryBank(index, "account_name", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Account Number</label>
                  <input
                    type="text"
                    value={bank.account_number}
                    onChange={(e) =>
                      updateSecondaryBank(
                        index,
                        "account_number",
                        e.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            ))}

            <div className="space-y-2 md:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800/50">
              <label htmlFor="notes" className={labelClass}>
                Internal Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={vendor.notes ?? ""}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            href={`/dashboard/vendors/${vendor.id}`}
            className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
          >
            {isPending ? (
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
