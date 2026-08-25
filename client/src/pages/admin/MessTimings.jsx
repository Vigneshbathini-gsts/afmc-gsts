import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { messTimingsAPI } from "../../services/api";

export default function MessTimings() {
  const [timings, setTimings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await messTimingsAPI.getWeeklyTimings();
      console.log("timings",res)
      setTimings(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Unable to load weekly timings.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (id, field, value) => {
    setTimings((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const validateTimings = () => {
    for (const row of timings) {
      const {
        day_name,
        shift1_open_time,
        shift1_close_time,
        shift2_open_time,
        shift2_close_time,
        active_flag,
      } = row;

      const hasShift1 =
        shift1_open_time && shift1_close_time;

      const hasShift2 =
        shift2_open_time && shift2_close_time;

      if (active_flag === "Y") {
        if (!hasShift1 && !hasShift2) {
          return `${day_name}: Configure at least one shift.`;
        }

        if (
          (shift1_open_time && !shift1_close_time) ||
          (!shift1_open_time && shift1_close_time)
        ) {
          return `${day_name}: Complete Shift 1 timings.`;
        }

        if (
          (shift2_open_time && !shift2_close_time) ||
          (!shift2_open_time && shift2_close_time)
        ) {
          return `${day_name}: Complete Shift 2 timings.`;
        }
      }

      if (
        shift1_open_time &&
        shift1_close_time &&
        shift1_open_time >= shift1_close_time
      ) {
        return `${day_name}: Shift 1 opening must be before closing.`;
      }

      if (
        shift2_open_time &&
        shift2_close_time &&
        shift2_open_time >= shift2_close_time
      ) {
        return `${day_name}: Shift 2 opening must be before closing.`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    const error = validateTimings();

    if (error) {
      toast.error(error);
      return;
    }

    try {
      setSaving(true);

      await messTimingsAPI.updateWeeklyTimings(timings);

      toast.success("Weekly timings updated successfully.");
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
          "Unable to update timings."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="text-lg font-semibold text-afmc-maroon">
          Loading Weekly Timings...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">

      <div className="mb-6 flex items-center justify-between">

        <div>
          <h2 className="text-2xl font-semibold text-afmc-maroon tracking-wide">
            Weekly Mess Timings
          </h2>

          <p className="text-sm text-gray-500">
            Configure two shifts for each day.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-afmc-maroon px-6 py-2 font-semibold text-white hover:bg-afmc-maroon/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>

      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow">

        <table className="min-w-full">

          <thead className="bg-afmc-maroon text-white">

            <tr>

              <th className="p-3">Day</th>

              <th className="p-3">Shift 1 From</th>

              <th className="p-3">Shift 1 To</th>

              <th className="p-3">Shift 2 From</th>

              <th className="p-3">Shift 2 To</th>

              <th className="p-3">Active</th>

            </tr>

          </thead>

          <tbody>

            {timings.map((row) => (
              <tr
                key={row.id}
                className={`border-b ${
                  row.active_flag === "Y"
                    ? "bg-white"
                    : "bg-gray-100"
                }`}
              >
                <td className="p-3 font-semibold">
                  {row.day_name}
                </td>

                {[
                  "shift1_open_time",
                  "shift1_close_time",
                  "shift2_open_time",
                  "shift2_close_time",
                ].map((field) => (
                  <td key={field} className="p-2">
                    <input
                      type="time"
                      value={row[field] || ""}
                      disabled={saving}
                      onChange={(e) =>
                        handleChange(
                          row.id,
                          field,
                          e.target.value
                        )
                      }
                      className="w-full rounded-md border px-2 py-2"
                    />
                  </td>
                ))}

                <td className="text-center">

                  <input
                    type="checkbox"
                    checked={row.active_flag === "Y"}
                    disabled={saving}
                    onChange={(e) =>
                      handleChange(
                        row.id,
                        "active_flag",
                        e.target.checked ? "Y" : "N"
                      )
                    }
                    className="h-5 w-5"
                  />

                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>
    </div>
  );
}