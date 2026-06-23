import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaClock,
  FaDoorOpen,
  FaLock,
  FaSave,
  FaSyncAlt,
  FaWineGlassAlt,
} from "react-icons/fa";
import { barStatusAPI } from "../../services/api";
import { toast } from "react-toastify";

const formatISTDateTime = (value) => {
  if (!value) return "Not available";

  const rawValue = String(value).trim();
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(rawValue);
  const normalizedValue = hasTimezone
    ? rawValue
    : `${rawValue.replace(" ", "T")}Z`;

  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return value;

  return `${new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date)} IST`;
};

const BarStatus = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [barStatus, setBarStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const isClosed = status === "Bar Is Close";

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      setMessage("");
      const response = await barStatusAPI.getStatus();
      const data = response.data?.data;

      setBarStatus(data || null);
      setStatus(data?.bar_status || "");
    } catch (error) {
      console.error(error);
      setMessage("Unable to load bar status");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage("");
      const response = await barStatusAPI.updateStatus(status);
      const data = response.data?.data;

      if (data) {
        setBarStatus(data);
        setStatus(data.bar_status);
      }
      setMessage("Bar status updated successfully");
      setMessageType("success");
      toast.success("Bar status updated successfully");
      navigate("/admin/dashboard");
    } catch (error) {
      console.error(error);
      setMessage(
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Unable to update bar status"
      );
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative overflow-hidden rounded-2xl">
      <div className="absolute top-11 left-10 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl" />
      <div className="absolute bottom-8 right-10 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-afmc-maroon shadow-sm ring-1 ring-afmc-maroon/10">
              <FaWineGlassAlt />
              Mess Control
            </div>
            <h1 className="mt-3 font-display text-2xl md:text-3xl font-bold text-afmc-maroonDark">
              Bar Status
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Open or close ordering access for active users.
            </p>
          </div>

          <button
            type="button"
            onClick={loadStatus}
            disabled={isLoading || isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-afmc-maroon/15 bg-white/80 px-4 py-3 text-sm font-semibold text-afmc-maroon shadow-sm transition hover:bg-white disabled:opacity-60"
          >
            <FaSyncAlt className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/50 bg-white/75 p-5 shadow-afmc backdrop-blur-md md:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Current Access
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Changes notify logged-in users immediately through live updates.
                </p>
              </div>

              <span
                className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${
                  isClosed
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                }`}
              >
                {isClosed ? <FaLock /> : <FaDoorOpen />}
                {isClosed ? "Closed" : "Open"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStatus("Bar Is Open")}
                className={`group rounded-3xl border p-5 text-left shadow-sm transition ${
                  status === "Bar Is Open"
                    ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200"
                    : "border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <FaDoorOpen />
                  </span>
                  {status === "Bar Is Open" && (
                    <FaCheckCircle className="text-emerald-600" />
                  )}
                </div>
                <div className="mt-4 text-lg font-bold text-gray-800">
                  Open Bar
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Users can browse menu, add cart items, and continue orders.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStatus("Bar Is Close")}
                className={`group rounded-3xl border p-5 text-left shadow-sm transition ${
                  status === "Bar Is Close"
                    ? "border-red-300 bg-red-50 ring-2 ring-red-200"
                    : "border-gray-100 bg-white hover:border-red-200 hover:bg-red-50/50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                    <FaLock />
                  </span>
                  {status === "Bar Is Close" && (
                    <FaCheckCircle className="text-red-600" />
                  )}
                </div>
                <div className="mt-4 text-lg font-bold text-gray-800">
                  Close Bar
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Non-exempt users are redirected to the bar closed page.
                </p>
              </button>
            </div>

            {message && (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                  messageType === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!status || isSaving || isLoading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-afmc-maroon px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-afmc-maroon/20 transition hover:bg-afmc-maroon2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <FaSave />
              {isSaving ? "Saving..." : "Save Status"}
            </button>
          </section>

          <aside className="rounded-3xl border border-white/50 bg-white/75 p-5 shadow-afmc backdrop-blur-md md:p-7">
            <h2 className="text-lg font-bold text-gray-800">
              Status Details
            </h2>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-afmc-maroon text-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-afmc-gold">
                  Active Rule
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {status || "Loading..."}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <FaClock />
                    Last Updated
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-700">
                    {formatISTDateTime(barStatus?.last_updated_date)}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Updated By
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-700">
                    {barStatus?.last_updated_by || "Not available"}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default BarStatus;
