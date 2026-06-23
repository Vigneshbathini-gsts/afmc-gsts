import { useEffect, useState } from "react";
import { barStatusAPI } from "../services/api";

const BarStatus = () => {
  const [status, setStatus] = useState("");

  const loadStatus = async () => {
    try {
      const response =
        await barStatusAPI.getStatus();

      setStatus(
        response.data.data.bar_status
      );
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async () => {
    try {
      await barStatusAPI.updateStatus(
        status
      );

      alert(
        "Bar status updated successfully"
      );
    } catch (error) {
      console.error(error);
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

      <button onClick={handleSave}>
        Save
      </button>
    </div>
  );
};

export default BarStatus;