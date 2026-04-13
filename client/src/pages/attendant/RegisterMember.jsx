import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsLeft } from "lucide-react";
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
    <div className="min-h-screen bg-[#efe7dc] p-3 sm:p-5">
      <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[26px] border border-[#ded1c1] bg-[linear-gradient(180deg,#fcfaf7_0%,#f4ede4_100%)] shadow-[0_20px_60px_rgba(78,56,30,0.08)]">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 35%, rgba(165, 128, 83, 0.18), transparent 28%), linear-gradient(180deg, rgba(139, 94, 60, 0.10), rgba(139, 94, 60, 0.03))",
          }}
        />

        <div className="relative flex min-h-[calc(100vh-2rem)] items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-6xl rounded-[30px] border border-[#e7dbce] bg-white/70 p-6 backdrop-blur-sm sm:p-10">
            <div className="mx-auto flex max-w-5xl flex-col gap-10 lg:min-h-[520px] lg:justify-between">
              <div className="flex flex-col gap-4">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#a2643d]">
                  New Order
                </p>
                <div className="max-w-xl">
                  <h1 className="text-3xl font-semibold text-[#3e3124] sm:text-4xl">
                    Capture non-member details
                  </h1>
                  <p className="mt-3 text-base text-[#6f5f52]">
                    Start with the phone number. If the customer already exists,
                    the saved first and last name will appear automatically.
                  </p>
                </div>
              </div>

              <div className="mx-auto w-full max-w-[520px] space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-[#6f5f52]">
                    Phone Number
                  </label>
                  <input
                    value={form.phoneNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        phoneNumber: event.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    placeholder="Phone Number"
                    className="h-[72px] w-full rounded-2xl border border-[#c5b7a5] bg-white/90 px-5 text-[20px] text-[#4f4235] outline-none transition focus:border-[#d70652] focus:ring-2 focus:ring-[#d70652]/15"
                  />
                  {lookupLoading ? (
                    <p className="text-sm text-[#8b7764]">Checking existing customer...</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-[#6f5f52]">
                    First Name
                  </label>
                  <input
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    placeholder="First Name"
                    className="h-[72px] w-full rounded-2xl border border-[#c5b7a5] bg-white/90 px-5 text-[20px] text-[#4f4235] outline-none transition focus:border-[#d70652] focus:ring-2 focus:ring-[#d70652]/15"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-[#6f5f52]">
                    Last Name
                  </label>
                  <input
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    placeholder="Last Name"
                    className="h-[72px] w-full rounded-2xl border border-[#c5b7a5] bg-white/90 px-5 text-[20px] text-[#4f4235] outline-none transition focus:border-[#d70652] focus:ring-2 focus:ring-[#d70652]/15"
                  />
                </div>

                {status.message ? (
                  <div className={`rounded-2xl border px-4 py-3 text-sm ${statusClassName}`}>
                    {status.message}
                  </div>
                ) : null}
              </div>

              <div className="flex w-full items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-2 rounded-full bg-[#7d756f] px-7 py-4 text-[18px] font-semibold text-white transition hover:bg-[#6e6660]"
                >
                  <ChevronsLeft size={20} />
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleProceed}
                  disabled={submitLoading}
                  className="rounded-full bg-[#d70652] px-8 py-4 text-[18px] font-semibold text-white transition hover:bg-[#b90546] disabled:cursor-not-allowed disabled:bg-[#d7b6c2]"
                >
                  {submitLoading ? "Saving..." : "Proceed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
