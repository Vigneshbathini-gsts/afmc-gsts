import { useEffect, useState } from "react";
import { messTimingsAPI } from "../../services/api";

export default function MessTimings() {

    const [timings,setTimings]=useState([]);
    const [loading,setLoading]=useState(true);
    const [saving, setSaving] = useState(false);



    useEffect(()=>{
        loadData();
    },[]);

    const handleSave = async () => {
  try {
    setSaving(true);

    await messTimingsAPI.updateWeeklyTimings(timings);

    alert("Weekly timings updated successfully.");
  } catch (error) {
    console.error(error);
    alert(
      error.response?.data?.message ||
      "Unable to update timings."
    );
  } finally {
    setSaving(false);
  }
};

    const handleChange = (id, field, value) => {
  setTimings((prev) =>
    prev.map((row) =>
      row.id === id
        ? {
            ...row,
            [field]: value,
          }
        : row
    )
  );
};

    const loadData = async()=>{

        try{

            const res = await messTimingsAPI.getWeeklyTimings();

            setTimings(res.data.data || []);

        }catch(err){

            console.log(err);

        }finally{
            setLoading(false);
        }

    };

    if(loading){
        return <div>Loading...</div>;
    }

    return(
        <div className="p-6">

            <h1 className="text-2xl font-bold mb-6">
                Weekly Mess Timings
            </h1>

            <div className="mt-6 flex justify-end">
  <button
    onClick={handleSave}
    disabled={saving}
    className="bg-afmc-maroon text-white px-6 py-2 rounded-lg hover:bg-afmc-maroon/90 disabled:opacity-50"
  >
    {saving ? "Saving..." : "Save Weekly Timings"}
  </button>
</div>
            <table className="min-w-full border">

                <thead>

                    <tr>

                        <th>Day</th>

                        <th>Shift 1 From</th>

                        <th>Shift 1 To</th>

                        <th>Shift 2 From</th>

                        <th>Shift 2 To</th>

                    </tr>

                </thead>

             

                    <tbody>
  {timings.map((row) => (
    <tr key={row.id} className="border-b">

      <td className="p-3 font-semibold">
        {row.day_name}
      </td>

      <td className="p-2">
        <input
          type="time"
          value={row.shift1_open_time || ""}
          onChange={(e) =>
            handleChange(
              row.id,
              "shift1_open_time",
              e.target.value
            )
          }
          className="border rounded px-2 py-1 w-full"
        />
      </td>

      <td className="p-2">
        <input
          type="time"
          value={row.shift1_close_time || ""}
          onChange={(e) =>
            handleChange(
              row.id,
              "shift1_close_time",
              e.target.value
            )
          }
          className="border rounded px-2 py-1 w-full"
        />
      </td>

      <td className="p-2">
        <input
          type="time"
          value={row.shift2_open_time || ""}
          onChange={(e) =>
            handleChange(
              row.id,
              "shift2_open_time",
              e.target.value
            )
          }
          className="border rounded px-2 py-1 w-full"
        />
      </td>

      <td className="p-2">
        <input
          type="time"
          value={row.shift2_close_time || ""}
          onChange={(e) =>
            handleChange(
              row.id,
              "shift2_close_time",
              e.target.value
            )
          }
          className="border rounded px-2 py-1 w-full"
        />
      </td>

      <td className="p-3 text-center">
        <input
          type="checkbox"
          checked={row.active_flag === "Y"}
          onChange={(e) =>
            handleChange(
              row.id,
              "active_flag",
              e.target.checked ? "Y" : "N"
            )
          }
        />
      </td>

    </tr>
  ))}

                </tbody>

            </table>

        </div>
    );

}