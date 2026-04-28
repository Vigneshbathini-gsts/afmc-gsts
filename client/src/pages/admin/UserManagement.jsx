import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronsLeft,
  Eye,
  X,
  PlusCircle,
  Search,
  UploadCloud,
} from "lucide-react";
import { userAPI } from "../../services/api";

const STATUS_STYLES = {
  Active: "bg-[#ebf7ef] text-[#1f7a3d] border-[#cbe8d3]",
  Inactive: "bg-[#fff1f1] text-[#b04444] border-[#f1c8c8]",
};

const INITIAL_FORM = {
  loginType: "Member",
  firstName: "",
  lastName: "",
  userName: "",
  password: "",
  confirmPassword: "",
  email: "",
  phoneNumber: "",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

const validateCreateForm = (formData) => {
  if (!formData.firstName.trim()) return "First name is required.";
  if (formData.firstName.trim().length < 2)
    return "First name must be at least 2 characters.";
  if (!formData.lastName.trim()) return "Last name is required.";
  if (!formData.userName.trim()) return "User name is required.";
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(formData.userName.trim())) {
    return "User name must be 3 to 50 characters and can only include letters, numbers, dot, underscore, and hyphen.";
  }
  if (!formData.password) return "Password is required.";
  if (formData.password.length < 6)
    return "Password must be at least 6 characters.";
  if (formData.password !== formData.confirmPassword) {
    return "Password and confirm password must match.";
  }
  if (!formData.email.trim()) return "Email is required.";
  if (!EMAIL_REGEX.test(formData.email.trim()))
    return "Please enter a valid email address.";
  if (!formData.phoneNumber.trim()) return "Phone number is required.";
  if (!PHONE_REGEX.test(formData.phoneNumber.trim()))
    return "Phone number must be exactly 10 digits.";
  return "";
};

export default function UserManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchUsers = useCallback(async (searchValue = "") => {
    try {
      setLoading(true);
      setError("");

      const response = await userAPI.getAll(searchValue.trim());
      setUsers(response.data?.data || []);
    } catch (fetchError) {
      console.error("Failed to fetch users:", fetchError);
      setUsers([]);
      setError(
        fetchError.response?.data?.message || "Unable to load user details."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    fetchUsers(search);
  };

  const visibleUsers = useMemo(() => users || [], [users]);

  const currentUser = useMemo(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const parsed = storedUser ? JSON.parse(storedUser) : null;
      return parsed?.username || parsed?.email || "SYSTEM";
    } catch (parseError) {
      return "SYSTEM";
    }
  }, []);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setFormError("");
    setFormSuccess("");
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setSaving(false);
    resetForm();
  };

  const openUploadModal = () => {
    setUploadFile(null);
    setUploadError("");
    setUploadSuccess("");
    setIsUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setUploadFile(null);
    setUploadError("");
    setUploadSuccess("");
    setUploading(false);
    setIsUploadModalOpen(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    const normalizedValue =
      name === "phoneNumber" ? value.replace(/\D/g, "").slice(0, 10) : value;

    setFormError("");
    setFormSuccess("");
    setFormData((prev) => ({
      ...prev,
      [name]: normalizedValue,
    }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    const trimmedPayload = {
      loginType: formData.loginType,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      userName: formData.userName.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      email: formData.email.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      createdBy: currentUser,
    };

    const validationMessage = validateCreateForm(formData);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    try {
      setSaving(true);
      const response = await userAPI.create(trimmedPayload);

      setFormSuccess(response.data?.message || "User created successfully.");

      await fetchUsers(search);

      setTimeout(() => {
        closeCreateModal();
      }, 900);
    } catch (saveError) {
      console.error("Failed to create user:", saveError);
      setFormError(
        saveError.response?.data?.message || "Unable to create user."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateDownload = () => {
    const csvContent = [
      [
        "Login Type",
        "Full Name With Rank",
        "First Name",
        "Last Name",
        "User Name",
        "Password",
        "Confirm Password",
        "Email",
      ].join(","),
      [
        "End User",
        "Capt Ram Kumar",
        "Ram",
        "Kumar",
        "ram.kumar",
        "Pass123",
        "Pass123",
        "ram.kumar@example.com",
      ].join(","),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "multiple-employee-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleUploadFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setUploadFile(selectedFile);
    setUploadError("");
    setUploadSuccess("");
  };

  const handleBulkUpload = async () => {
    if (!uploadFile) {
      setUploadError("Please choose a CSV file to upload.");
      return;
    }

    const formPayload = new FormData();
    formPayload.append("file", uploadFile);
    formPayload.append("createdBy", currentUser);

    try {
      setUploading(true);
      setUploadError("");
      setUploadSuccess("");

      const response = await userAPI.bulkUpload(formPayload);
      const result = response.data?.data;

      const skippedMessages = (result?.skippedRows || [])
        .slice(0, 5)
        .map((item) => item.reason)
        .join(" | ");

      setUploadSuccess(
        `${response.data?.message || "Bulk upload completed."} Skipped: ${
          result?.skippedCount || 0
        }${skippedMessages ? ` (${skippedMessages})` : ""}`
      );

      await fetchUsers(search);
    } catch (uploadSaveError) {
      console.error("Failed to bulk upload users:", uploadSaveError);
      const backendErrors = uploadSaveError.response?.data?.errors;
      setUploadError(
        Array.isArray(backendErrors) && backendErrors.length
          ? backendErrors.join(" | ")
          : uploadSaveError.response?.data?.message ||
              "Unable to upload users."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 h-72 w-72 rounded-full bg-afmc-maroon/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-afmc-maroon2/10 blur-3xl" />

      <div className="relative z-10 p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-800">User Management</h1>
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 rounded-full border border-white/60 bg-white px-5 py-2.5 text-gray-700 shadow hover:shadow-md"
          >
            <ChevronsLeft size={16} />
            Go To Dashboard
          </button>
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <Search size={18} className="text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleSearch();
                      }
                    }}
                    placeholder="Search by user name, officer id, role..."
                    className="w-full bg-transparent text-gray-800 outline-none placeholder:text-gray-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSearch}
                  className="flex items-center gap-2 rounded-2xl bg-afmc-maroon px-5 py-3 font-semibold text-white shadow-afmc transition hover:bg-afmc-maroon2 focus:outline-none focus:ring-2 focus:ring-afmc-gold/50"
                >
                  <Search size={16} />
                  Search
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openUploadModal}
                className="inline-flex items-center gap-2 rounded-2xl border border-afmc-maroon bg-white px-5 py-3 font-semibold text-afmc-maroon transition hover:bg-afmc-maroon/5"
              >
                <UploadCloud size={18} />
                Upload Users Details
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-2xl border border-afmc-maroon bg-white px-5 py-3 font-semibold text-afmc-maroon transition hover:bg-afmc-maroon/5"
              >
                <PlusCircle size={18} />
                Add User
              </button>
            </div>
          </div>

          <div className="mt-6 md:mt-8">
            {error ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-afmc-gold/25 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-afmc-maroon/5 text-afmc-maroon">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    View
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    User Name
                  </th>
                  {/* <th className="px-4 py-3 text-left font-medium">
                    Officer ID
                  </th> */}
                  <th className="px-4 py-3 text-left font-medium">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Login Type</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan="6">
                      Loading user details...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-red-600" colSpan="6">
                      {error}
                    </td>
                  </tr>
                ) : visibleUsers.length ? (
                  visibleUsers.map((user) => {
                    const statusClass =
                      STATUS_STYLES[user.status] || STATUS_STYLES.Inactive;

                    return (
                      <tr
                        key={user.USER_ID}
                        className="border-t border-gray-100 transition-colors hover:bg-afmc-gold/10"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/users/${user.USER_ID}`)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-afmc-maroon transition hover:bg-afmc-maroon/10"
                            aria-label={`View ${user.USER_NAME}`}
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {user.USER_NAME || "-"}
                        </td>
                        {/* <td className="px-4 py-3 text-gray-700">
                          {user.OFFICER_ID || "-"}
                        </td> */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusClass}`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {user.Role || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {user.LOGIN_TYPE
                            ? `${user.LOGIN_TYPE.charAt(0)}${user.LOGIN_TYPE
                                .slice(1)
                                .toLowerCase()}`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan="6">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c2118]/35 p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-5 shadow-2xl backdrop-blur-md">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(193,173,144,0.12)_0%,rgba(193,173,144,0.04)_38%,transparent_68%)]" />

            <div className="relative mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Add User</h2>
                <p className="text-xs text-gray-500">
                  Create a new account using the same form pattern as inventory management.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="text-gray-500 transition hover:text-gray-700"
                aria-label="Close create user modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="relative">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Login Type
                  </label>
                  <select
                    name="loginType"
                    value={formData.loginType}
                    onChange={handleFormChange}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                  >
                    <option value="Member">Member</option>
                    <option value="Non Member">Non Member</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleFormChange}
                    maxLength={50}
                    placeholder="Enter first name"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleFormChange}
                    maxLength={50}
                    placeholder="Enter last name"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    User Name
                  </label>
                  <input
                    type="text"
                    name="userName"
                    value={formData.userName}
                    onChange={handleFormChange}
                    maxLength={50}
                    placeholder="Enter user name"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    maxLength={100}
                    placeholder="Enter email"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    minLength={6}
                    placeholder="Enter password"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleFormChange}
                    minLength={6}
                    placeholder="Re-enter password"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleFormChange}
                    inputMode="numeric"
                    pattern="\d{10}"
                    maxLength={10}
                    placeholder="Enter 10-digit phone number"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                  />
                </div>
              </div>

              {formError ? (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-[#b04444]">
                  {formError}
                </p>
              ) : null}

              {formSuccess ? (
                <p className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-[#2f7a3f]">
                  {formSuccess}
                </p>
              ) : null}

              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-full bg-gray-600 px-5 py-2 text-sm font-semibold text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-afmc-maroon px-5 py-2 text-sm font-semibold text-white transition hover:bg-afmc-maroon2 disabled:cursor-not-allowed disabled:bg-[#9cac74]"
                >
                  <PlusCircle size={18} />
                  {saving ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isUploadModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c2118]/35 p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-[18px] border border-[#d8ccbe] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,245,239,0.98)_100%)] shadow-[0_30px_90px_rgba(61,41,18,0.22)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(193,173,144,0.16)_0%,rgba(193,173,144,0.05)_34%,transparent_65%)]" />

            <div className="relative flex items-center justify-between border-b border-[#eadfd2] px-5 py-3">
              <h2 className="text-[20px] font-semibold text-[#2a221b]">
                Multiple Employee Creation
              </h2>
              <button
                type="button"
                onClick={closeUploadModal}
                className="text-[#5d5044] transition hover:text-[#1f1a15]"
                aria-label="Close upload users modal"
              >
                <X size={22} />
              </button>
            </div>

            <div className="relative p-5">
              <div className="rounded-[14px] border border-[#e5dbd0] bg-white/90 p-4 shadow-[0_12px_30px_rgba(61,41,18,0.12)]">
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTemplateDownload}
                    className="rounded-md bg-[#3f3935] px-5 py-2 text-base font-semibold text-white transition hover:bg-[#302b28]"
                  >
                    Sample Template
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm text-[#5f564d]">
                      Upload File:
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleUploadFileChange}
                      className="block w-full rounded-md border border-dashed border-[#9b8f82] bg-white px-3 py-2 text-[#241d17] file:mr-4 file:rounded file:border-0 file:bg-transparent file:text-base"
                    />
                  </div>

                  {uploadError ? (
                    <p className="text-sm font-medium text-[#b04444]">
                      {uploadError}
                    </p>
                  ) : null}

                  {uploadSuccess ? (
                    <p className="text-sm font-medium text-[#2f7a3f]">
                      {uploadSuccess}
                    </p>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleBulkUpload}
                      disabled={uploading}
                      className="rounded-md bg-[#3f3935] px-8 py-2 text-lg font-semibold text-white transition hover:bg-[#302b28] disabled:cursor-not-allowed disabled:bg-[#8f8883]"
                    >
                      {uploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}