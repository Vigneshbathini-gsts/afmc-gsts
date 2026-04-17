import React, { useEffect, useState } from "react";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaKey } from "react-icons/fa";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { authAPI } from "../../services/api";

const ResetPassword = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    username: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const usernameFromUrl = searchParams.get("username");
    if (usernameFromUrl) {
      setFormData((prev) => ({
        ...prev,
        username: usernameFromUrl,
      }));
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    const { username, newPassword, confirmPassword } = formData;

    if (!username || !newPassword || !confirmPassword) {
      setError("Please fill all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match");
      return;
    }

    try {
      setLoading(true);

      const res = await authAPI.resetPassword({
        token,
        username,
        password: newPassword,
        confirmPassword,
      });

      setMessage(res.data?.message || "Password reset successful");

      setFormData((prev) => ({
        ...prev,
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (err) {
      console.error("Reset Password Error:", err);
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2">
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-afmc-maroon/10 via-afmc-bg2 to-afmc-maroon2/10">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-afmc-maroon blur-3xl opacity-20"></div>
          <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-afmc-maroon2 blur-3xl opacity-20"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center p-14 w-full">
          <div className="max-w-xl">
            <p className="text-afmc-maroon uppercase tracking-[0.25em] text-sm mb-4 font-semibold">
              Secure Reset
            </p>

            <h2 className="text-5xl font-extrabold leading-tight text-gray-800 mb-6">
              Set a New <br />
              Password
            </h2>

            <p className="text-gray-600 text-lg leading-relaxed max-w-lg">
              Update your AFMC account password securely and regain access to your
              portal with confidence.
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-10 bg-white relative">
        <div className="absolute top-16 right-16 h-40 w-40 rounded-full bg-afmc-maroon/10 blur-3xl"></div>
        <div className="absolute bottom-16 left-16 h-52 w-52 rounded-full bg-afmc-maroon2/10 blur-3xl"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white/80 border border-afmc-maroon/10 shadow-xl rounded-3xl p-8 md:p-10 backdrop-blur-sm">
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center bg-gradient-to-br from-afmc-maroon to-afmc-maroon2 p-4 rounded-2xl shadow-lg mb-4">
                <FaKey className="text-white text-2xl" />
              </div>

              <p className="text-afmc-maroon text-sm uppercase tracking-[0.25em] mb-2 font-semibold">
                Reset Password
              </p>
              <h2 className="text-3xl font-bold mb-2 text-gray-800">
                Create New Password
              </h2>
              <p className="text-gray-500 text-sm">
                Please enter your new password below.
              </p>
            </div>

            {message && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">
                {message}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">
                  Username
                </label>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                  <FaUser className="text-gray-400" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    readOnly
                    className="w-full bg-transparent outline-none text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">
                  New Password
                </label>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                  <FaLock className="text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="Enter new password"
                    className="w-full bg-transparent outline-none text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-gray-400 hover:text-afmc-maroon"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">
                  Confirm Password
                </label>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                  <FaLock className="text-gray-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm new password"
                    className="w-full bg-transparent outline-none text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="text-gray-400 hover:text-afmc-maroon"
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-afmc-maroon to-afmc-maroon2 hover:from-afmc-maroon2 hover:to-afmc-maroon text-white font-bold py-3.5 rounded-2xl shadow-md shadow-afmc-maroon/30 transition duration-300 transform hover:scale-[1.01] disabled:opacity-70"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-sm text-afmc-maroon hover:text-afmc-maroon2 transition font-medium"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
