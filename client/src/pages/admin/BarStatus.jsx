import { useEffect, useState } from "react";
import { barStatusAPI } from "../../services/api";

const BarStatus = () => {
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = async () => {
    try {
      const response =
        await barStatusAPI.getStatus();

      setStatus(
        response.data.data.bar_status
      );
    } catch (error) {
      console.error(error);
      setMessage("Unable to load bar status");
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage("");
      await barStatusAPI.updateStatus(
        status
      );

      setMessage("Bar status updated successfully");
    } catch (error) {
      console.error(error);
      setMessage("Unable to update bar status");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h2>Bar Status</h2>

      <label>
        <input
          type="radio"
          value="Bar Is Open"
          checked={
            status === "Bar Is Open"
          }
          onChange={(e) =>
            setStatus(e.target.value)
          }
        />
        Open
      </label>

      <label>
        <input
          type="radio"
          value="Bar Is Close"
          checked={
            status === "Bar Is Close"
          }
          onChange={(e) =>
            setStatus(e.target.value)
          }
        />
        Close
      </label>

      <br />

      <button onClick={handleSave} disabled={!status || isSaving}>
        {isSaving ? "Saving..." : "Save"}
      </button>

      {message && <p>{message}</p>}
    </div>
  );
};

export default BarStatus;
