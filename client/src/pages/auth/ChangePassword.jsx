import React, { useState } from "react";
import axios from "axios";
import { FaLock, FaArrowLeft, FaEye, FaEyeSlash } from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function ChangePassword() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");

        if (!password || !confirmPassword) {
            setError("Please fill all fields");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            setLoading(true);

            const res = await axios.post(
                "http://localhost:5000/api/auth/reset-password",
                {
                    token,
                    password,
                }
            );

            setMessage(res.data.message);

            setTimeout(() => {
                navigate("/login");
            }, 2000);
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
                        <FaLock size={22} />
                    </div>
                </div>

                {/* Heading */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
                    <p className="text-sm text-gray-500 mt-2">
                        Enter your new password below
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            New Password
                        </label>

                        <div className="flex items-center border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-afmc-maroon focus-within:border-afmc-maroon transition">
                            <FaLock className="text-gray-400 mr-3" />
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter new password"
                                className="w-full outline-none text-gray-700 bg-transparent"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-gray-500"
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Confirm Password
                        </label>

                        <div className="flex items-center border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-afmc-maroon focus-within:border-afmc-maroon transition">
                            <FaLock className="text-gray-400 mr-3" />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm new password"
                                className="w-full outline-none text-gray-700 bg-transparent"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setShowConfirmPassword(!showConfirmPassword)
                                }
                                className="text-gray-500"
                            >
                                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
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
                        {loading ? "Resetting..." : "Reset Password"}
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
