import { useEffect, useState } from "react";
import {
  FaClock,
  FaSignOutAlt,
  FaCalendarAlt,
  FaRegClock,
} from "react-icons/fa";
import { clearAuthData } from "../../utils/authStorage";

const BarClosed = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    clearAuthData();
    window.location.href = "/login";
  };

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const formattedDate = currentTime.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 px-4 py-10">

      {/* Background Decorations */}
      <div className="absolute left-[-80px] top-[-80px] h-80 w-80 rounded-full bg-afmc-maroon/10 blur-3xl" />
      <div className="absolute bottom-[-120px] right-[-80px] h-96 w-96 rounded-full bg-afmc-gold/20 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-afmc-maroon via-afmc-gold to-afmc-maroon2" />

      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-afmc-gold/30 bg-white shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-afmc-maroon via-afmc-maroon2 to-afmc-maroon px-8 py-8 text-center text-white">

          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl ring-4 ring-afmc-gold/30">

            <FaClock className="text-5xl text-afmc-gold" />

          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-afmc-gold/40 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-afmc-gold">

            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400"></span>

            Mess Closed

          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-wide">
            Outside Serving Hours
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/85">
            Ordering is currently unavailable because the present time is
            outside today's approved serving schedule. The system will
            automatically reopen during the next configured shift.
          </p>
        </div>

        {/* Body */}
        <div className="p-8">

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">

            {/* Status */}
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-center shadow-sm">

              <div className="text-xs font-semibold uppercase tracking-widest text-red-500">
                Status
              </div>

              <div className="mt-3 text-lg font-bold text-red-700">
                Closed
              </div>

            </div>

            {/* Current Time */}
            <div className="rounded-2xl border border-afmc-gold/30 bg-yellow-50 p-5 text-center shadow-sm">

              <div className="flex justify-center text-afmc-maroon">

                <FaRegClock size={18} />

              </div>

              <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Current Time
              </div>

              <div className="mt-2 text-lg font-bold text-afmc-maroon">
                {formattedTime}
              </div>

            </div>

            {/* Current Date */}
            <div className="rounded-2xl border border-afmc-gold/30 bg-white p-5 text-center shadow-sm">

              <div className="flex justify-center text-afmc-maroon">

                <FaCalendarAlt size={18} />

              </div>

              <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Today
              </div>

              <div className="mt-2 text-sm font-semibold text-gray-700">
                {formattedDate}
              </div>

            </div>

            {/* Next Action */}
            <div className="rounded-2xl border border-afmc-gold/30 bg-afmc-bg p-5 text-center shadow-sm">

              <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Next Action
              </div>

              <div className="mt-3 text-lg font-bold text-afmc-maroon">
                Login Later
              </div>

            </div>

          </div>

          {/* Information Box */}

          <div className="mt-8 rounded-2xl border border-afmc-gold/30 bg-gradient-to-r from-yellow-50 to-white p-6">

            <h3 className="text-lg font-bold text-afmc-maroon">
              Service Information
            </h3>

            <div className="mt-4 space-y-3 text-sm leading-7 text-gray-700">

              <p>
                • The mess is currently outside its configured operating hours.
              </p>

              <p>
                • Ordering will automatically become available once the next
                scheduled shift begins.
              </p>

              <p>
                • No administrator action is required. Simply log in again
                during the next serving session.
              </p>

            </div>

          </div>

          {/* Footer */}

          <div className="mt-8 flex flex-col items-center">

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-afmc-maroon via-afmc-maroon2 to-afmc-maroon px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <FaSignOutAlt />

              Logout

            </button>

            <p className="mt-5 text-center text-xs text-gray-500">
              AFMC Mess Management System
              <br />
              Access will be restored automatically during scheduled timings.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
};

export default BarClosed;