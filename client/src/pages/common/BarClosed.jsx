import {
  FaLock,
  FaSignOutAlt,
  FaWineGlassAlt,
} from "react-icons/fa";
import { clearAuthData } from "../../utils/authStorage";

const BarClosed = () => {
  const handleLogout = () => {
    clearAuthData();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative overflow-hidden px-4 py-8 flex items-center justify-center">
      <div className="absolute top-12 left-8 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl" />
      <div className="absolute bottom-8 right-8 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-afmc-maroon via-afmc-gold to-afmc-maroon2" />

      <main className="relative w-full max-w-3xl">
        <section className="overflow-hidden rounded-3xl border border-white/50 bg-white/80 shadow-afmc backdrop-blur-md">
          <div className="bg-afmc-maroon px-6 py-8 text-center text-white md:px-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-afmc-gold ring-1 ring-white/20">
              <FaLock className="text-2xl" />
            </div>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-afmc-gold ring-1 ring-white/15">
              <FaWineGlassAlt />
              Access Paused
            </div>

            <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">
              Service is Currently Closed
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/80 md:text-base">
              Access is temporarily paused because the current timing window is closed. Ordering will resume once the admin reopens the schedule.
            </p>
          </div>

          <div className="px-6 py-6 md:px-10 md:py-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Current Status
                </div>
                <div className="mt-2 font-bold text-red-700">
                  Paused
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  User Access
                </div>
                <div className="mt-2 font-bold text-afmc-maroon">
                  Paused
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Next Step
                </div>
                <div className="mt-2 font-bold text-gray-700">
                  Try Again Later
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-afmc-maroon/10 bg-afmc-bg p-4 text-center text-sm font-semibold text-gray-600">
              Please logout now. You can log in again after the schedule is reopened.
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-afmc-maroon px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-afmc-maroon/20 transition hover:bg-afmc-maroon2 sm:w-auto"
              >
                <FaSignOutAlt />
                Logout
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default BarClosed;
