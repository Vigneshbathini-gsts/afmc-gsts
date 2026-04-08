import React, { useState } from "react";
import { FaTimes, FaLock } from "react-icons/fa";
import { authAPI } from "../../services/api";
import { useNavigate } from "react-router-dom";

export default function ChangePasswordModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New password and confirm password do not match");
      return;
    }

    try {
      setLoading(true);


      await authAPI.changePassword({
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });

      setMessage("Password changed successfully!");

      setFormData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        onClose();
        setMessage("");
          navigate("/login");
      }, 1200);
    } catch (error) {
      setError(error.response?.data?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-fadeIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-xl"
        >
          <FaTimes />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#d70652] p-3 rounded-xl text-white">
            <FaLock />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Change Password</h2>
            <p className="text-sm text-gray-500">Update your account password</p>
          </div>
        </div>

        {/* Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-100 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-lg bg-green-100 text-green-700 px-4 py-2 text-sm">
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Old Password
            </label>
            <input
              type="password"
              name="oldPassword"
              value={formData.oldPassword}
              onChange={handleChange}
              className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#d70652]/30"
              placeholder="Enter old password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#d70652]/30"
              placeholder="Enter new password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#d70652]/30"
              placeholder="Confirm new password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-semibold py-3 rounded-xl transition ${loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#d70652] hover:bg-[#b90545]"
              }`}
          >
            {loading ? "Saving..." : "Save Password"}
          </button>
        </form>
      </div>
    </div>
  );
}