import React, { useState, useEffect, useCallback } from "react";
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaUtensils,
  FaWineGlass,
  FaExclamationTriangle,
  FaArrowRight,
  FaUserShield,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/AFMC_Logo.png";

const AFMCLogo = logo;

// Validation helpers
const validateUsername = (username) => {
  if (!username || !username.trim()) return false;
  // Accepts: email, service number (alphanumeric with hyphen/underscore), or username
  const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
  const serviceNoRegex = /^[A-Z0-9]{5,15}$/i;
  const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;
  return emailRegex.test(username) || serviceNoRegex.test(username) || usernameRegex.test(username);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [outletType, setOutletType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOutletDropdown, setShowOutletDropdown] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [isCheckingRole, setIsCheckingRole] = useState(false);
  const { user, isLoading, setUser } = useAuth();
  const navigate = useNavigate();

  // Load saved credentials
  useEffect(() => {
    const savedEmail = localStorage.getItem("afmc_remembered_email");
    const savedRemember = localStorage.getItem("afmc_remember_me") === "true";
    if (savedEmail && savedRemember) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      navigate(getRedirectPath(user), { replace: true });
    }
  }, [user, isLoading, navigate]);

  const getRedirectPath = (user) => {
    switch (user.roleId) {
      case 10: return "/admin/dashboard";
      case 20: return "/attendant/dashboard";
      case 30: return "/user/dashboard";
      case 40:
        if (user.outletType === "KITCHEN") return "/kitchen/dashboard";
        if (user.outletType === "BAR") return "/bar/dashboard";
        return "/kitchen/dashboard";
      case 50: return "/storekeeper/dashboard";
      default: return "/";
    }
  };

  const fetchUserRole = useCallback(async () => {
    if (!email.trim() || !validateUsername(email.trim())) {
      setShowOutletDropdown(false);
      return;
    }

    setIsCheckingRole(true);
    try {
      const response = await authAPI.getRole({ username: email.trim() });
      const shouldShow = Boolean(response.data?.showOutletSelection);
      setShowOutletDropdown(shouldShow);
      if (!shouldShow) setOutletType("");
    } catch (error) {
      console.error("Role fetch error:", error);
      setShowOutletDropdown(false);
      setOutletType("");
    } finally {
      setIsCheckingRole(false);
    }
  }, [email]);

  // Debounced role fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email && touched.email && validateUsername(email)) {
        fetchUserRole();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [email, touched.email, fetchUserRole]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!validateUsername(email.trim())) {
      setError("Please enter a valid username, service number, or email address");
      return;
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (showOutletDropdown && !outletType) {
      setError("Please select an outlet type");
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.login({
        username: email.trim(),
        password,
        outletType,
      });

      if (response.data?.success) {
        // Handle remember me
        if (rememberMe) {
          localStorage.setItem("afmc_remembered_email", email.trim());
          localStorage.setItem("afmc_remember_me", "true");
        } else {
          localStorage.removeItem("afmc_remembered_email");
          localStorage.setItem("afmc_remember_me", "false");
        }

        localStorage.setItem("token", response.data.token);
        setUser(response.data.user);
        
        setTimeout(() => {
          navigate(response.data.redirectPath);
        }, 100);
        return;
      }
      setError(response.data?.message || "Login failed");
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const getEmailError = () => {
    if (!touched.email) return "";
    if (!email) return "Username or service number is required";
    if (!validateUsername(email)) return "Please enter a valid username, service number, or email";
    return "";
  };

  const getPasswordError = () => {
    if (!touched.password) return "";
    if (!password) return "Password is required";
    if (!validatePassword(password)) return "Password must be at least 6 characters";
    return "";
  };

  if (isLoading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Loading secure portal...</p>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* Left decorative panel */}
      <div style={styles.leftPanel} className="afmc-left-panel">
        {/* Background pattern */}
        <div style={styles.patternOverlay} aria-hidden="true">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.patternDot,
                top: `${Math.floor(i / 6) * 18 + 4}%`,
                left: `${(i % 6) * 17 + 2}%`,
                opacity: 0.06 + (i % 3) * 0.04,
              }}
            />
          ))}
        </div>

        {/* Decorative rings */}
        <div style={styles.ring1} aria-hidden="true" />
        <div style={styles.ring2} aria-hidden="true" />

        <div style={styles.leftContent}>
          {/* Crest */}
          <div style={styles.crestWrap}>
            <div style={styles.crestGlow} aria-hidden="true" />
            <div style={styles.crestCircle}>
              <img
                src={AFMCLogo}
                alt="AFMC Crest"
                style={styles.crestImg}
                onError={(e) => {
                  e.target.style.display = "none";
                  if (e.target.nextSibling) {
                    e.target.nextSibling.style.display = "flex";
                  }
                }}
              />
              <div style={{ ...styles.crestFallback, display: "none" }}>
                <FaShieldAlt style={{ fontSize: 52, color: "#DAA520" }} />
              </div>
            </div>
          </div>

          {/* Title */}
          <div style={styles.orgName}>AFMC</div>
          <div style={styles.orgFull}>Armed Forces Medical College</div>

          <div style={styles.goldRule} aria-hidden="true" />

          <div style={styles.portalTitle}>Mess &amp; Dining Services</div>
          <div style={styles.portalSub}>Management Portal</div>

          {/* Outlet icons */}
          <div style={styles.iconRow}>
            <div style={styles.iconPill}>
              <FaUtensils style={{ fontSize: 14, color: "#DAA520" }} />
              <span style={styles.iconLabel}>Mess Hall</span>
            </div>
            <div style={styles.iconPill}>
              <FaWineGlass style={{ fontSize: 14, color: "#DAA520" }} />
              <span style={styles.iconLabel}>Officers' Bar</span>
            </div>
          </div>

          {/* Security badge */}
          <div style={styles.securityBadge}>
            <FaUserShield style={{ fontSize: 12 }} />
            <span>Secure Access</span>
          </div>
        </div>

        {/* Bottom motto */}
        <div style={styles.motto}>
          <span style={styles.mottoText}>सर्वे सन्तु निरामयाः</span>
          
        </div>
      </div>

      {/* Right login panel */}
      <div style={styles.rightPanel}>
        {/* Subtle background accent */}
        <div style={styles.rightAccent} aria-hidden="true" />

        <div style={styles.formCard}>
          {/* Mobile logo */}
          <div style={styles.mobileLogo}>
            <img src={AFMCLogo} alt="AFMC" style={{ width: 48, height: 48, objectFit: "contain" }} />
            <span style={styles.mobileTitle}>AFMC Portal</span>
          </div>

          {/* Header */}
          <div style={styles.formHeader}>
            <div style={styles.eyebrow}>Secure Sign-In</div>
            <h1 style={styles.formTitle}>Welcome back</h1>
            <p style={styles.formSub}>
              Enter your credentials to access the mess management system.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={styles.errorBox} role="alert">
              <FaExclamationTriangle style={styles.errorIcon} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate>
            {/* Username */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel} htmlFor="afmc-email">
                Username / Service Number / Email
              </label>
              <div style={{
                ...styles.inputWrap,
                borderColor: getEmailError() && touched.email ? "#e74c3c" : "rgba(107,26,79,0.2)"
              }}>
                <FaEnvelope style={styles.inputIcon} aria-hidden="true" />
                <input
                  id="afmc-email"
                  type="text"
                  placeholder="e.g., john.doe, IC-12345, or john@afmc.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                  style={styles.input}
                  required
                  autoComplete="username"
                  aria-invalid={!!getEmailError()}
                />
                {isCheckingRole && <div style={styles.inputSpinner} />}
              </div>
              {touched.email && getEmailError() && (
                <p style={styles.errorText}>{getEmailError()}</p>
              )}
            </div>

            {/* Password */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel} htmlFor="afmc-password">
                Password
              </label>
              <div style={{
                ...styles.inputWrap,
                borderColor: getPasswordError() && touched.password ? "#e74c3c" : "rgba(107,26,79,0.2)"
              }}>
                <FaLock style={styles.inputIcon} aria-hidden="true" />
                <input
                  id="afmc-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                  placeholder="Enter your password"
                  style={styles.input}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!getPasswordError()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  className="afmc-eye-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {touched.password && getPasswordError() && (
                <p style={styles.errorText}>{getPasswordError()}</p>
              )}
            </div>

            {/* Outlet selection */}
            {showOutletDropdown && (
              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Select Outlet</label>
                <div style={styles.outletRow}>
                  <OutletCard
                    icon={<FaUtensils />}
                    label="Mess / Kitchen"
                    value="KITCHEN"
                    selected={outletType === "KITCHEN"}
                    onClick={() => setOutletType("KITCHEN")}
                  />
                  <OutletCard
                    icon={<FaWineGlass />}
                    label="Officers' Bar"
                    value="BAR"
                    selected={outletType === "BAR"}
                    onClick={() => setOutletType("BAR")}
                  />
                </div>
              </div>
            )}

            {/* Remember + forgot */}
            <div style={styles.optionsRow}>
              <label style={styles.rememberLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: "#7B2252", width: 14, height: 14 }}
                />
                <span style={{ marginLeft: 7, fontSize: 12, color: "#666" }}>Remember me</span>
              </label>
              <a href="/forgot-password" style={styles.forgotLink} className="afmc-forgot">
                Forgot password?
                <FaArrowRight style={{ fontSize: 10, marginLeft: 4 }} />
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitBtn,
                opacity: loading ? 0.72 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              className="afmc-submit-btn"
            >
              {loading ? (
                <span style={styles.btnSpinnerWrap}>
                  <span style={styles.btnSpinner} />
                  Signing in…
                </span>
              ) : (
                <>
                  Sign In
                  <FaArrowRight style={{ fontSize: 11 }} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div style={styles.footerRow}>
            <div style={styles.footerLine} />
            <span style={styles.footerText}>
              <FaShieldAlt style={{ fontSize: 11, marginRight: 5 }} />
              Protected by AFMC Authentication
            </span>
            <div style={styles.footerLine} />
          </div>

          {/* Version */}
          <div style={styles.versionText}>
            v2.0 | Enterprise Grade Security
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap');

        * { box-sizing: border-box; }

        #afmc-email, #afmc-password {
          font-family: 'Source Sans 3', sans-serif;
        }

        @keyframes afmcFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes afmcFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes afmcSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes crestPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50%       { transform: scale(1.08); opacity: 0.75; }
        }
        @keyframes loadSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .afmc-left-panel { display: none !important; }
        @media (min-width: 900px) {
          .afmc-left-panel { display: flex !important; }
        }
        .afmc-left-content { animation: afmcFadeIn 0.9s ease both; }
        .afmc-form-card    { animation: afmcFadeUp 0.65s ease both 0.1s; }

        .afmc-outlet-card:hover {
          border-color: #DAA520 !important;
          background: rgba(218,165,32,0.12) !important;
          transform: translateY(-2px);
        }
        .afmc-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #7B2252 0%, #5c1648 100%) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(107,26,79,0.35) !important;
        }
        .afmc-submit-btn:active:not(:disabled) {
          transform: translateY(0px);
        }
        .afmc-eye-btn:hover { color: #7B2252 !important; }
        .afmc-forgot:hover  { color: #DAA520 !important; }

        input:focus {
          outline: none;
        }
        .afmc-outlet-card:focus-visible {
          outline: 2px solid #DAA520;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

/* Outlet card sub-component */
function OutletCard({ icon, label, value, selected, onClick }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="afmc-outlet-card"
      style={{
        flex: 1,
        border: selected ? "1.5px solid #DAA520" : "1px solid rgba(123,34,82,0.25)",
        borderRadius: 12,
        padding: "14px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        background: selected ? "rgba(218,165,32,0.1)" : "rgba(107,26,79,0.04)",
        transition: "all 0.2s ease",
        outline: "none",
      }}
      aria-pressed={selected}
    >
      <span style={{ fontSize: 22, color: selected ? "#DAA520" : "#7B2252" }}>{icon}</span>
      <span style={{
        fontSize: 12,
        fontWeight: selected ? 600 : 500,
        color: selected ? "#7B2252" : "#888",
        fontFamily: "'Source Sans 3', sans-serif",
        letterSpacing: "0.03em",
      }}>
        {label}
      </span>
    </div>
  );
}

/* Styles */
const MAROON   = "#6B1A4F";
const MAROON2  = "#7B2252";
const GOLD     = "#DAA520";
const GOLD_DIM = "rgba(218,165,32,0.65)";

const styles = {
  root: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'Source Sans 3', sans-serif",
  },

  /* Loading */
  loadingScreen: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f9f5f7 0%, #f0e9ed 100%)",
    gap: 16,
  },
  loadingSpinner: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: `3px solid rgba(107,26,79,0.15)`,
    borderTopColor: MAROON,
    animation: "loadSpin 0.8s linear infinite",
  },
  loadingText: {
    color: MAROON2,
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: "0.05em",
  },

  /* Left panel */
  leftPanel: {
    width: "42%",
    background: `linear-gradient(145deg, #3A0D30 0%, #5c1648 45%, #6B1A4F 100%)`,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "48px 36px 32px",
    position: "relative",
    overflow: "hidden",
  },
  patternOverlay: { position: "absolute", inset: 0, pointerEvents: "none" },
  patternDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: "50%",
    background: GOLD,
  },
  ring1: {
    position: "absolute",
    top: -120,
    right: -120,
    width: 340,
    height: 340,
    borderRadius: "50%",
    border: `1px solid rgba(218,165,32,0.1)`,
    pointerEvents: "none",
  },
  ring2: {
    position: "absolute",
    bottom: -100,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: "50%",
    border: `1px solid rgba(218,165,32,0.08)`,
    pointerEvents: "none",
  },
  leftContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    position: "relative",
    zIndex: 1,
    animation: "afmcFadeIn 0.9s ease both",
  },
  crestWrap: { position: "relative", marginBottom: 24 },
  crestGlow: {
    position: "absolute",
    inset: -18,
    borderRadius: "50%",
    background: `radial-gradient(circle, rgba(218,165,32,0.18) 0%, transparent 70%)`,
    animation: "crestPulse 4s ease-in-out infinite",
  },
 crestImg: {
  position: "absolute",   // ✅ force perfect centering
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)", // ✅ true center
  width: "70%",           // adjust visually (try 65–75%)
  height: "70%",
  objectFit: "contain",
},
  crestImg: { width: 118, height: 118, objectFit: "contain" },
  crestFallback: { alignItems: "center", justifyContent: "center" },
  orgName: {
    fontFamily: "'Cinzel', serif",
    fontSize: 28,
    fontWeight: 700,
    color: GOLD,
    letterSpacing: "0.22em",
    marginBottom: 6,
  },
  orgFull: {
    fontSize: 11,
    color: GOLD_DIM,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginBottom: 22,
    textAlign: "center",
  },
  goldRule: {
    width: 56,
    height: 1,
    background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
    marginBottom: 22,
  },
  portalTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: "0.06em",
    marginBottom: 4,
    textAlign: "center",
  },
  portalSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: 30,
    textAlign: "center",
  },
  iconRow: { display: "flex", gap: 12 },
  iconPill: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "rgba(218,165,32,0.1)",
    border: "0.5px solid rgba(218,165,32,0.25)",
    borderRadius: 20,
    padding: "7px 14px",
  },
  iconLabel: {
    fontSize: 11,
    color: GOLD_DIM,
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  },
  securityBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    padding: "6px 12px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    fontSize: 10,
    color: GOLD_DIM,
    letterSpacing: "0.05em",
  },
  motto: {
    position: "relative",
    zIndex: 1,
    borderTop: "0.5px solid rgba(218,165,32,0.2)",
    paddingTop: 16,
    width: "100%",
    textAlign: "center",
  },
  mottoText: {
    fontFamily: "'Cinzel', serif",
    fontSize: 14,
    color: "rgba(218,165,32,0.65)",
    letterSpacing: "0.08em",
    display: "block",
  },
  mottoSub: {
    fontSize: 9,
    color: "rgba(218,165,32,0.4)",
    letterSpacing: "0.1em",
    display: "block",
    marginTop: 4,
  },

  /* Right panel */
  rightPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #faf8f9 0%, #f5f0f3 100%)",
    padding: "40px 24px",
    position: "relative",
    minHeight: "100vh",
  },
  rightAccent: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 320,
    height: 320,
    borderRadius: "0 0 0 100%",
    background: `radial-gradient(circle, rgba(107,26,79,0.06) 0%, transparent 70%)`,
    pointerEvents: "none",
  },
  formCard: {
    width: "100%",
    maxWidth: 440,
    background: "#ffffff",
    borderRadius: 20,
    border: `0.5px solid rgba(107,26,79,0.1)`,
    padding: "40px 36px",
    position: "relative",
    zIndex: 1,
    boxShadow: "0 8px 40px rgba(107,26,79,0.1)",
    animation: "afmcFadeUp 0.65s ease both 0.1s",
  },
  mobileLogo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
    justifyContent: "center",
    paddingBottom: 16,
    borderBottom: "0.5px solid rgba(107,26,79,0.1)",
  },
  mobileTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 18,
    fontWeight: 600,
    color: MAROON,
    letterSpacing: "0.1em",
  },
  formHeader: { marginBottom: 28 },
  eyebrow: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: GOLD,
    marginBottom: 8,
  },
  formTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 24,
    fontWeight: 700,
    color: "#1a1a1a",
    marginBottom: 6,
    letterSpacing: "0.02em",
  },
  formSub: {
    fontSize: 13,
    color: "#888",
    lineHeight: 1.5,
    margin: 0,
  },

  /* Error */
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#fff5f5",
    border: "1px solid #f5c2c7",
    borderRadius: 10,
    color: "#c0392b",
    fontSize: 12,
    padding: "12px 16px",
    marginBottom: 20,
  },
  errorIcon: { fontSize: 14, flexShrink: 0 },

  /* Fields */
  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#555",
    marginBottom: 8,
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid rgba(107,26,79,0.2)",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#ffffff",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  inputIcon: { fontSize: 14, color: "#aaa", flexShrink: 0 },
  input: {
    flex: 1,
    border: "none",
    background: "transparent",
    fontSize: 14,
    color: "#1a1a1a",
    outline: "none",
    fontFamily: "'Source Sans 3', sans-serif",
  },
  eyeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#aaa",
    fontSize: 14,
    padding: 0,
    transition: "color 0.15s",
    lineHeight: 1,
  },
  outletRow: { display: "flex", gap: 12 },
  inputSpinner: {
    width: 14,
    height: 14,
    border: "2px solid rgba(218,165,32,0.2)",
    borderTopColor: GOLD,
    borderRadius: "50%",
    animation: "afmcSpin 0.6s linear infinite",
  },
  errorText: {
    fontSize: 11,
    color: "#e74c3c",
    marginTop: 6,
    marginLeft: 4,
  },

  /* Options row */
  optionsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  rememberLabel: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  },
  forgotLink: {
    fontSize: 12,
    color: MAROON2,
    textDecoration: "none",
    fontWeight: 600,
    transition: "color 0.15s",
    display: "flex",
    alignItems: "center",
  },

  /* Submit */
  submitBtn: {
    width: "100%",
    padding: "14px",
    border: "none",
    borderRadius: 12,
    background: `linear-gradient(135deg, ${MAROON} 0%, ${MAROON2} 100%)`,
    color: GOLD,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: "'Source Sans 3', sans-serif",
    boxShadow: `0 4px 14px rgba(107,26,79,0.3)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 0,
  },
  btnSpinnerWrap: { display: "flex", alignItems: "center", gap: 8 },
  btnSpinner: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: `2px solid rgba(218,165,32,0.3)`,
    borderTopColor: GOLD,
    animation: "afmcSpin 0.7s linear infinite",
    display: "inline-block",
  },

  /* Footer */
  footerRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
  },
  footerLine: {
    flex: 1,
    height: "0.5px",
    background: "rgba(107,26,79,0.15)",
  },
  footerText: {
    fontSize: 11,
    color: "#aaa",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    letterSpacing: "0.04em",
  },
  versionText: {
    textAlign: "center",
    fontSize: 10,
    color: "#bbb",
    marginTop: 16,
    letterSpacing: "0.05em",
  },
  
};
