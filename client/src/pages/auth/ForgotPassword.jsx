import React, { useState } from "react";
import { FaEnvelope, FaArrowLeft } from "react-icons/fa";
import { Link } from "react-router-dom";
import { authAPI } from "../../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!email) {
      setError("Please enter your email");
      return;
    }

    try {
      setLoading(true);

      const res = await authAPI.forgotPassword({ email });

      console.log("Forgot Password Response:", res.data);

      setMessage(res.data.message);
      setEmail("");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-afmc-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-afmc-maroon/10">
        {/* Top Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-br from-afmc-maroon to-afmc-maroon2 p-4 rounded-2xl text-white shadow-md">
            <FaEnvelope size={22} />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Forgot Password</h2>
          <p className="text-sm text-gray-500 mt-2">
            Enter your registered email to receive a reset link
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>

            <div className="flex items-center border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-afmc-maroon focus-within:border-afmc-maroon transition">
              <FaEnvelope className="text-gray-400 mr-3" />
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full outline-none text-gray-700 bg-transparent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Success */}
          {message && (
            <div className="bg-green-100 text-green-700 text-sm px-4 py-3 rounded-xl border border-green-200">
              {message}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-100 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold py-3 rounded-xl shadow-md transition disabled:opacity-70"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        {/* Back to Login */}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-afmc-maroon hover:text-afmc-maroon2 hover:underline font-medium transition"
          >
            <FaArrowLeft size={12} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
