import React, { useEffect, useState } from "react";
import { ChevronsLeft, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { userAPI } from "../../services/api";

const INITIAL_FORM = {
  userName: "",
  firstName: "",
  loginType: "Member",
  roleId: "",
  status: "Active",
  email: "",
  phoneNumber: "",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

const validateEditForm = (formData, roles) => {
  const firstName = String(formData.firstName || "").trim();
  const email = String(formData.email || "").trim();
  const phoneNumber = String(formData.phoneNumber || "").trim();

  if (!firstName) return "Officer name is required.";
  if (firstName.length < 2)
    return "Officer name must be at least 2 characters.";
  if (!formData.loginType) return "Login type is required.";
  if (!["Member", "Non Member"].includes(formData.loginType))
    return "Invalid login type selected.";
  if (!formData.roleId) return "Role is required.";
  if (!roles.some((role) => String(role.ROLE_ID) === String(formData.roleId))) {
    return "Please select a valid role.";
  }
  if (!["Active", "Inactive"].includes(formData.status))
    return "Invalid status selected.";
  if (!email) return "Email is required.";
  if (!EMAIL_REGEX.test(email))
    return "Please enter a valid email address.";
  if (!phoneNumber) return "Phone number is required.";
  if (!PHONE_REGEX.test(phoneNumber))
    return "Phone number must be exactly 10 digits.";
  return "";
};

export default function UserEdit() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await userAPI.getById(id);
        const user = response.data?.data;

        setFormData({
          userName: user?.USER_NAME || "",
          firstName: user?.First_name || "",
          loginType: user?.LOGIN_TYPE || "Member",
          roleId: user?.ROLE_ID ? String(user.ROLE_ID) : "",
          status: user?.status || "Active",
          email: user?.EMAIL || "",
          phoneNumber: user?.PHONE_NUMBER ? String(user.PHONE_NUMBER) : "",
        });
      } catch (fetchError) {
        console.error("Failed to fetch user:", fetchError);
        setError(
          fetchError.response?.data?.message || "Unable to load user details."
        );
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [id]);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        setLoadingRoles(true);
        const response = await userAPI.getRoleOptions(formData.loginType);
        const roleOptions = response.data?.data || [];

        setRoles(roleOptions);
        setFormData((prev) => {
          const hasMatchingRole = roleOptions.some(
            (role) => String(role.ROLE_ID) === String(prev.roleId)
          );

          return {
            ...prev,
            roleId: hasMatchingRole
              ? prev.roleId
              : roleOptions[0]?.ROLE_ID
                ? String(roleOptions[0].ROLE_ID)
                : "",
          };
        });
      } catch (fetchError) {
        console.error("Failed to fetch roles:", fetchError);
        setRoles([]);
      } finally {
        setLoadingRoles(false);
      }
    };

    if (formData.loginType) {
      loadRoles();
    }
  }, [formData.loginType]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const normalizedValue =
      name === "phoneNumber" ? value.replace(/\D/g, "").slice(0, 10) : value;
    setSuccess("");
    setError("");
    setFormData((prev) => ({
      ...prev,
      [name]: normalizedValue,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationMessage = validateEditForm(formData, roles);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      setSaving(true);
      const response = await userAPI.update(id, {
        firstName: formData.firstName.trim(),
        loginType: formData.loginType,
        roleId: Number(formData.roleId),
        status: formData.status,
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
      });

      const updatedUser = response.data?.data;

      setFormData((prev) => ({
        ...prev,
        roleId: updatedUser?.ROLE_ID ? String(updatedUser.ROLE_ID) : prev.roleId,
        status: updatedUser?.status || prev.status,
        loginType: updatedUser?.LOGIN_TYPE || prev.loginType,
      }));

      setSuccess(response.data?.message || "User updated successfully.");
    } catch (saveError) {
      console.error("Failed to update user:", saveError);
      setError(
        saveError.response?.data?.message || "Unable to update user."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f5f1eb_0%,#efe7de_50%,#f8f5f0_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[28px] border border-[#deceb9] bg-white/90 p-4 shadow-[0_20px_60px_rgba(92,69,43,0.08)] backdrop-blur sm:p-6">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#2d241d]">
            User role assignment
          </h1>

          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="inline-flex items-center gap-2 rounded-full bg-[#7a6e62] px-5 py-3 font-semibold text-white transition hover:bg-[#665b50]"
          >
            <ChevronsLeft size={18} />
            Back
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[24px] border border-[#eadfd2] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,245,239,0.98)_100%)] px-4 py-8 sm:px-8">
          <div className="pointer-events-none absolute inset-y-0 left-[10%] hidden w-[45%] rounded-full bg-[radial-gradient(circle,rgba(187,164,136,0.12)_0%,rgba(187,164,136,0.02)_55%,transparent_72%)] lg:block" />

          {loading ? (
            <div className="relative py-20 text-center text-[#5f564d]">
              Loading user details...
            </div>
          ) : error && !formData.userName ? (
            <div className="relative py-20 text-center text-[#b04444]">
              {error}
            </div>
          ) : (
            <form
              onSubmit={handleSave}
              className="relative mx-auto max-w-2xl space-y-6"
            >
              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                <div className="text-right font-semibold text-[#5a4d40]">
                  User Name
                </div>
                <div className="text-lg font-semibold text-[#2d241d]">
                  {formData.userName || "-"}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                <label
                  htmlFor="firstName"
                  className="text-right font-semibold text-[#5a4d40]"
                >
                  Officer Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  maxLength={50}
                  className="w-full rounded-md border border-[#9b8f82] bg-white px-4 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                <label
                  htmlFor="loginType"
                  className="text-right font-semibold text-[#5a4d40]"
                >
                  Login Type
                </label>
                <select
                  id="loginType"
                  name="loginType"
                  value={formData.loginType}
                  onChange={handleChange}
                  className="w-full rounded-md border border-[#9b8f82] bg-white px-4 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                >
                  <option value="Member">Member</option>
                  <option value="Non Member">Non Member</option>
                </select>
              </div>

              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                <label
                  htmlFor="roleId"
                  className="text-right font-semibold text-[#5a4d40]"
                >
                  Role
                </label>
                <select
                  id="roleId"
                  name="roleId"
                  value={formData.roleId}
                  onChange={handleChange}
                  disabled={loadingRoles}
                  className="w-full rounded-md border border-[#9b8f82] bg-white px-4 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f] disabled:bg-[#f3eee7]"
                >
                  {roles.map((role) => (
                    <option key={role.ROLE_ID} value={role.ROLE_ID}>
                      {role.ROLE_NAME}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                <label
                  htmlFor="status"
                  className="text-right font-semibold text-[#5a4d40]"
                >
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full rounded-md border border-[#9b8f82] bg-white px-4 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                <label
                  htmlFor="email"
                  className="text-right font-semibold text-[#5a4d40]"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  maxLength={100}
                  className="w-full rounded-md border border-[#9b8f82] bg-white px-4 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                <label
                  htmlFor="phoneNumber"
                  className="text-right font-semibold text-[#5a4d40]"
                >
                  Phone Number
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="text"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                  className="w-full rounded-md border border-[#9b8f82] bg-white px-4 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />
              </div>

              {error ? (
                <p className="text-sm font-medium text-[#b04444]">{error}</p>
              ) : null}

              {success ? (
                <p className="text-sm font-medium text-[#2f7a3f]">{success}</p>
              ) : null}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving || loadingRoles}
                  className="inline-flex items-center gap-2 rounded-full bg-[#6f931f] px-6 py-3 font-semibold text-white transition hover:bg-[#5d7c1a] disabled:cursor-not-allowed disabled:bg-[#9cac74]"
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
