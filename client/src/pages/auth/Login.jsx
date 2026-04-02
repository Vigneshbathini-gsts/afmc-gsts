import React, { useState } from "react";
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaPizzaSlice,
  FaHamburger,
  FaIceCream,
  FaCoffee,
  FaCookieBite,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import {authAPI} from "../../services/api";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authAPI.login({ 
        username: email, // Your backend expects 'username'
        password: password 
      });
      
      console.log("Login response:", response.data);
      
      if (response.data.success) {
        // Store token and user data
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        
        // Navigate to the redirect path from backend
        navigate(response.data.redirectPath);
      } else {
        setError(response.data.message || "Login failed");
      }
    } catch (error) {
      console.error("Error during login:", error);
      setError(
        error.response?.data?.message || 
        error.response?.data?.error || 
        "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-pink-50 via-rose-50 to-white">
      {/* Left Section - same as before */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-[#d70652]/10 via-rose-100 to-[#ff025e]/10">
        {/* Background glow */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-[#d70652] blur-3xl opacity-20"></div>
          <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-[#ff025e] blur-3xl opacity-20"></div>
        </div>

        {/* Floating Food Icons */}
        <div className="absolute inset-0 pointer-events-none">
          <FaPizzaSlice className="absolute top-[22%] left-[18%] text-[#d70652] text-5xl animate-float1 drop-shadow-md" />
          <FaHamburger className="absolute top-[40%] left-[65%] text-[#ff025e] text-6xl animate-float2 drop-shadow-md" />
          <FaIceCream className="absolute top-[62%] left-[22%] text-[#d70652] text-5xl animate-float3 drop-shadow-md" />
          <FaCoffee className="absolute top-[28%] left-[75%] text-[#ff025e] text-5xl animate-float4 drop-shadow-md" />
          <FaCookieBite className="absolute top-[72%] left-[58%] text-[#d70652] text-5xl animate-float5 drop-shadow-md" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-14 w-full">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-gradient-to-br from-[#d70652] to-[#ff025e] p-3 rounded-2xl shadow-lg">
                <FaShieldAlt className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-wide text-gray-800">AFMC</h1>
              </div>
            </div>

            <div className="mt-20 max-w-xl relative">
              <p className="text-[#d70652] uppercase tracking-[0.25em] text-sm mb-4 font-semibold">
                Welcome Back
              </p>

              <h2 className="text-5xl font-extrabold leading-tight text-gray-800 mb-6">
                Fresh Meals, <br />
                Faster Access
              </h2>

              <p className="text-gray-600 text-lg leading-relaxed max-w-lg">
                Sign in to manage your food orders, meal plans, and mess services
                with a seamless experience.
              </p>

              <div className="mt-12 relative w-72 h-72">
                <div className="absolute inset-0 rounded-full bg-[#d70652]/10 blur-3xl"></div>
                <div className="absolute inset-8 rounded-full border border-[#ff025e]/30 bg-white/60 backdrop-blur-sm shadow-xl"></div>
                <div className="absolute top-16 left-16 text-7xl animate-bounce-slow">🍽️</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-10 bg-white relative">
        <div className="absolute top-16 right-16 h-40 w-40 rounded-full bg-[#d70652]/10 blur-3xl"></div>
        <div className="absolute bottom-16 left-16 h-52 w-52 rounded-full bg-[#ff025e]/10 blur-3xl"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white/80 border border-[#ff025e]/20 shadow-xl rounded-3xl p-8 md:p-10 backdrop-blur-sm">
            <div className="mb-8">
              <p className="text-[#d70652] text-sm uppercase tracking-[0.25em] mb-2 font-semibold">
                Sign In
              </p>
              <h2 className="text-3xl font-bold mb-2 text-gray-800">Welcome back</h2>
              <p className="text-gray-500 text-sm">
                Enter your credentials to access your account.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email/Username */}
              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">
                  Username / Email
                </label>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-[#ff025e] focus-within:ring-2 focus-within:ring-[#ff025e]/20 transition-all">
                  <FaEnvelope className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter your username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-gray-700 mb-2 font-medium">
                  Password
                </label>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-[#ff025e] focus-within:ring-2 focus-within:ring-[#ff025e]/20 transition-all">
                  <FaLock className="text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-[#d70652] transition"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[#d70652] w-4 h-4 rounded"
                  />
                  Remember me
                </label>

                <a
                  href="/forgot-password"
                  className="text-[#d70652] hover:text-[#ff025e] transition font-medium"
                >
                  Forgot password?
                </a>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#d70652] to-[#ff025e] hover:from-[#ff025e] hover:to-[#d70652] text-white font-bold py-3.5 rounded-2xl shadow-md shadow-[#d70652]/30 transition duration-300 transform hover:scale-[1.01] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="h-px flex-1 bg-gray-200"></div>
              <span className="text-gray-400 text-sm">Secure Access</span>
              <div className="h-px flex-1 bg-gray-200"></div>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-gray-400">
              Protected by AFMC Authentication System
            </div>
          </div>

          {/* Mobile branding */}
          <div className="lg:hidden text-center mt-8">
            <h1 className="text-2xl font-bold text-gray-800">AFMC Portal</h1>
            <p className="text-gray-500 text-sm mt-1">
              Secure institutional access
            </p>
          </div>
        </div>
      </div>

      {/* Add keyframe animations */}
      <style jsx>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-25px) rotate(-5deg); }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }
        @keyframes float4 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-22px) rotate(-3deg); }
        }
        @keyframes float5 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(4deg); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float1 { animation: float1 6s ease-in-out infinite; }
        .animate-float2 { animation: float2 7s ease-in-out infinite; }
        .animate-float3 { animation: float3 5.5s ease-in-out infinite; }
        .animate-float4 { animation: float4 8s ease-in-out infinite; }
        .animate-float5 { animation: float5 6.5s ease-in-out infinite; }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}