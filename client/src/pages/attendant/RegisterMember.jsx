import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsLeft, UserPlus, Phone, User, Users } from "lucide-react";
import { orderAPI } from "../../services/api";

export default function RegisterMember() {
  const navigation = useNavigate();
  const [form, setForm] = useState({
    phoneNumber: "",
    firstName: "",
    lastName: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const redirectToDashboard = () => {
    window.location.assign("/user/dashboard-Page");
  };

  useEffect(() => {
    const phoneNumber = form.phoneNumber.trim();
    if (phoneNumber.length !== 10) {
      setLookupLoading(false);
      return;
    }

    let active = true;
    setLookupLoading(true);
    setStatus((current) =>
      current.type === "success" ? { type: "", message: "" } : current
    );

    const timeoutId = setTimeout(async () => {
      try {
        const response = await orderAPI.lookupNonMember(phoneNumber);
        const existingMember = response.data?.data;

        if (!active) {
          return;
        }

        if (existingMember) {
          setForm((current) => ({
            ...current,
            firstName: existingMember.first_name || "",
            lastName: existingMember.last_name || "",
          }));
          setStatus({
            type: "info",
            message: "Existing phone number found. Name fields were filled automatically.",
          });
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus({
          type: "error",
          message:
            error.response?.data?.message || "Unable to verify phone number right now.",
        });
      } finally {
        if (active) {
          setLookupLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [form.phoneNumber]);

  const handleProceed = async () => {
    const payload = {
      phoneNumber: form.phoneNumber.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
    };

    if (!/^\d{10}$/.test(payload.phoneNumber)) {
      setStatus({
        type: "error",
        message: "Enter a valid 10-digit phone number.",
      });
      return;
    }

    if (!payload.firstName) {
      setStatus({
        type: "error",
        message: "First name is required.",
      });
      return;
    }

    setSubmitLoading(true);
    setStatus({ type: "", message: "" });

    try {
      await orderAPI.saveNonMember(payload);
      setForm({
        phoneNumber: "",
        firstName: "",
        lastName: "",
      });
      setStatus({ type: "", message: "" });
      navigation("/attendant/dashboard");
    } catch (error) {
      setStatus({
        type: "error",
        message: error.response?.data?.message || "Unable to save customer details.",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = () => {
    setForm({
      phoneNumber: "",
      firstName: "",
      lastName: "",
    });
    setStatus({ type: "", message: "" });
    redirectToDashboard();
  };

  const statusClassName =
    status.type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : status.type === "success"
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header with back navigation */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={handleCancel}
            className="group flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-sm transition-all hover:bg-stone-50 hover:text-stone-900"
          >
            <ChevronsLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs font-medium text-stone-400">New Order</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-stone-200/50">
          <div className="grid lg:grid-cols-2">
            {/* Left Column - Illustration / Info */}
            <div className="relative hidden overflow-hidden bg-gradient-to-br from-rose-50 to-amber-50 p-8 lg:block">
              <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-rose-100/50 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-64 w-64 rounded-full bg-amber-100/50 blur-3xl"></div>
              
              <div className="relative flex h-full flex-col justify-between">
                <div>
                  <div className="mb-8 inline-flex rounded-xl bg-white/60 p-3 backdrop-blur-sm">
                    <UserPlus className="h-8 w-8 text-rose-500" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-stone-800">
                    Guest Checkout
                  </h2>
                  <p className="mt-4 text-stone-600">
                    Create an order for a non-member customer. Their information will be saved for future visits.
                  </p>
                </div>

                {/* Clean SVG Illustration */}
                <div className="my-8 flex justify-center">
                  <svg
                    width="260"
                    height="220"
                    viewBox="0 0 300 250"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-lg"
                  >
                    <g>
                      {/* Profile Card Background */}
                      <rect
                        x="60"
                        y="80"
                        width="180"
                        height="140"
                        rx="20"
                        fill="white"
                        stroke="#F43F5E"
                        strokeWidth="2"
                        strokeOpacity="0.3"
                      />
                      <rect
                        x="60"
                        y="80"
                        width="180"
                        height="50"
                        rx="20"
                        fill="#F43F5E"
                        fillOpacity="0.1"
                      />

                      {/* Avatar Circle */}
                      <circle cx="150" cy="105" r="28" fill="#F43F5E" fillOpacity="0.2" stroke="#F43F5E" strokeWidth="2" />
                      <circle cx="150" cy="97" r="10" fill="#F43F5E" fillOpacity="0.8" />
                      <path d="M133 118 C133 108, 167 108, 167 118" stroke="#F43F5E" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                      {/* Form Fields Placeholder */}
                      <rect x="85" y="145" width="130" height="8" rx="4" fill="#E5E7EB" />
                      <rect x="85" y="162" width="100" height="8" rx="4" fill="#E5E7EB" />
                      <rect x="85" y="179" width="120" height="8" rx="4" fill="#E5E7EB" />

                      {/* Checkmark Badge */}
                      <circle cx="220" cy="100" r="16" fill="#10B981" fillOpacity="0.15" stroke="#10B981" strokeWidth="1.5" />
                      <path d="M214 100 L218 104 L226 96" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

                      {/* Phone Icon connecting */}
                      <circle cx="85" cy="195" r="12" fill="#FBBF24" fillOpacity="0.15" stroke="#FBBF24" strokeWidth="1.5" />
                      <path d="M80 191 L83 188 L87 192 L84 195 L80 191Z" fill="#FBBF24" fillOpacity="0.8" />
                      <path d="M83 188 L86 185" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />

                      {/* Decorative dots */}
                      <circle cx="70" cy="70" r="3" fill="#F43F5E" fillOpacity="0.3" />
                      <circle cx="230" cy="70" r="2" fill="#FBBF24" fillOpacity="0.4" />
                      <circle cx="250" cy="150" r="2.5" fill="#10B981" fillOpacity="0.3" />
                      <circle cx="55" cy="160" r="2" fill="#F43F5E" fillOpacity="0.25" />
                    </g>
                  </svg>
                </div>

                {/* Steps */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm text-stone-500">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">1</div>
                    <span>Enter phone number to check for existing customer</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-stone-500">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">2</div>
                    <span>Name fields auto-fill if customer exists</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-stone-500">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">3</div>
                    <span>Review and proceed to order creation</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="p-6 md:p-8 lg:p-10">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">
                  Customer Information
                </p>
                <h3 className="mt-1 text-xl font-semibold text-stone-800">Capture Details</h3>
                <p className="mt-1 text-sm text-stone-500">
                  Start with the phone number. If the customer already exists, the saved name will appear automatically.
                </p>
              </div>

              <div className="space-y-6">
                {/* Phone Number Field */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-stone-700">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Phone size={18} className="text-stone-400" />
                    </div>
                    <input
                      value={form.phoneNumber}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          phoneNumber: event.target.value.replace(/\D/g, "").slice(0, 10),
                        }))
                      }
                      placeholder="Enter 10-digit mobile number"
                      className="h-12 w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-4 text-stone-800 placeholder:text-stone-400 focus:border-rose-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                  {lookupLoading && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-500">
                      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-rose-400"></span>
                      Checking existing customer...
                    </p>
                  )}
                </div>

                {/* First Name Field */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-stone-700">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <User size={18} className="text-stone-400" />
                    </div>
                    <input
                      value={form.firstName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                      placeholder="First name"
                      className="h-12 w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-4 text-stone-800 placeholder:text-stone-400 focus:border-rose-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                </div>

                {/* Last Name Field */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-stone-700">
                    Last Name
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Users size={18} className="text-stone-400" />
                    </div>
                    <input
                      value={form.lastName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                      placeholder="Last name"
                      className="h-12 w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-4 text-stone-800 placeholder:text-stone-400 focus:border-rose-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                </div>

                {/* Status Message */}
                {status.message && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${statusClassName}`}>
                    {status.message}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-full border border-stone-200 bg-white px-6 py-2.5 text-sm font-medium text-stone-600 transition-all hover:bg-stone-50 hover:text-stone-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProceed}
                    disabled={submitLoading}
                    className="rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 hover:shadow-md disabled:cursor-not-allowed disabled:bg-rose-300"
                  >
                    {submitLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      "Proceed to Order"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}