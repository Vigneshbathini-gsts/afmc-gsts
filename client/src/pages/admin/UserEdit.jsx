import React, { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
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

const STATUS_STYLES = {
  Active: "bg-[#ebf7ef] text-[#1f7a3d] border-[#cbe8d3]",
  Inactive: "bg-[#fff1f1] text-[#b04444] border-[#f1c8c8]",
};

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
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 h-72 w-72 rounded-full bg-afmc-maroon/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-afmc-maroon2/10 blur-3xl" />

      <div className="relative z-10 p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">User Details</h1>
            <p className="mt-1 text-sm text-gray-500">
              Update role, status, and contact information for this account.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="flex items-center gap-2 rounded-full border border-white/60 bg-white px-5 py-2.5 text-gray-700 shadow hover:shadow-md"
          >
            <ArrowLeft size={16} />
            Back To Users
          </button>
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center text-gray-500">
              Loading user details...
            </div>
          ) : error && !formData.userName ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-16 text-center text-red-600">
              {error}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">User Name</p>
                      <h2 className="mt-1 text-2xl font-semibold text-gray-800">
                        {formData.userName || "-"}
                      </h2>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${
                        STATUS_STYLES[formData.status] || STATUS_STYLES.Inactive
                      }`}
                    >
                      {formData.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label
                        htmlFor="firstName"
                        className="mb-2 block text-sm font-medium text-gray-700"
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
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="loginType"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Login Type
                      </label>
                      <select
                        id="loginType"
                        name="loginType"
                        value={formData.loginType}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                      >
                        <option value="Member">Member</option>
                        <option value="Non Member">Non Member</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="status"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Status
                      </label>
                      <select
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor="roleId"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Role
                      </label>
                      <select
                        id="roleId"
                        name="roleId"
                        value={formData.roleId}
                        onChange={handleChange}
                        disabled={loadingRoles}
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {roles.map((role) => (
                          <option key={role.ROLE_ID} value={role.ROLE_ID}>
                            {role.ROLE_NAME}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Contact Information
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Keep the user email and phone number up to date.
                  </p>

                  <div className="mt-5 space-y-5">
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-2 block text-sm font-medium text-gray-700"
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
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="phoneNumber"
                        className="mb-2 block text-sm font-medium text-gray-700"
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
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {success}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/admin/users")}
                  className="rounded-2xl bg-gray-600 px-6 py-3 font-semibold text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || loadingRoles}
                  className="inline-flex items-center gap-2 rounded-2xl bg-afmc-maroon px-6 py-3 font-semibold text-white shadow transition hover:bg-afmc-maroon2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
