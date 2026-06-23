const BarClosed = () => {
  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "100px",
      }}
    >
      <h1>⏰ Time is Up!</h1>

      <h2>Bar is closed.</h2>

      <button
        onClick={() => {
          localStorage.clear();
          window.location.href = "/";
        }}
      >
        Logout
      </button>
    </div>
  );
};

export default BarClosed;