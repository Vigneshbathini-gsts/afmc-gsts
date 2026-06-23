import { clearAuthData } from "../../utils/authStorage";

const BarClosed = () => {
  const handleLogout = () => {
    clearAuthData();
    window.location.href = "/login";
  };

  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "100px",
      }}
    >
      <h1>Time is Up!</h1>

      <h2>Bar is closed.</h2>

      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default BarClosed;
