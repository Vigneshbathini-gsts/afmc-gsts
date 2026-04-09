import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
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

      if (trimmedPayload.loginType === "Non Member") {
        setFormSuccess(
          "User created successfully. Non Member records are not shown in this Member-only list."
        );
      }

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
    <div className="min-h-screen bg-[linear-gradient(135deg,#f5f1eb_0%,#efe7de_50%,#f8f5f0_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[28px] border border-[#deceb9] bg-white/85 p-4 shadow-[0_20px_60px_rgba(92,69,43,0.08)] backdrop-blur sm:p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[#d8c8b4] bg-white px-4 py-3 text-[#4f4235]">
              <Search size={18} />
              <ChevronDown size={16} />
            </div>

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
              className="w-full min-w-[220px] flex-1 rounded-xl border border-[#bfae9a] bg-white px-4 py-3 text-[#2d241d] outline-none transition focus:border-[#9d6d2f] sm:max-w-[320px]"
            />

            <button
              type="button"
              onClick={handleSearch}
              className="font-semibold text-[#2f251d] transition hover:text-[#9d6d2f]"
            >
              Go
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 font-semibold text-[#2f251d] transition hover:text-[#9d6d2f]"
            >
              Actions
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openUploadModal}
              className="inline-flex items-center gap-2 rounded-full border border-[#1b76d1] bg-white px-5 py-3 font-semibold text-[#f07a10] transition hover:bg-[#f7fbff]"
            >
              <UploadCloud size={18} className="text-[#f07a10]" />
              Upload Users Details
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin/dashboard")}
              className="inline-flex items-center gap-2 rounded-full bg-[#7a6e62] px-5 py-3 font-semibold text-white transition hover:bg-[#665b50]"
            >
              <ChevronsLeft size={18} />
              Go To Dashboard
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-full border border-[#1b76d1] bg-white px-5 py-3 font-semibold text-[#f07a10] transition hover:bg-[#f7fbff]"
            >
              <PlusCircle size={18} className="text-[#f07a10]" />
              Add User
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[24px] border border-[#e2d7ca] bg-white">
          <div className="pointer-events-none absolute inset-y-0 left-[10%] hidden w-[38%] rounded-full bg-[radial-gradient(circle,rgba(187,164,136,0.12)_0%,rgba(187,164,136,0.02)_55%,transparent_72%)] lg:block" />

          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-center">
              <thead className="bg-[#faf7f3] text-sm font-medium text-[#5f564d]">
                <tr>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4">
                    View
                  </th>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4">
                    User Name
                  </th>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4">
                    Officer ID
                  </th>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4">
                    Status
                  </th>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4">
                    Role
                  </th>
                  <th className="border-b px-4 py-4">Login Type</th>
                </tr>
              </thead>

              <tbody className="text-[#231f1b]">
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center" colSpan="6">
                      Loading user details...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-[#b04444]"
                      colSpan="6"
                    >
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
                        className="border-b border-[#eee4d9] bg-white/90 transition hover:bg-[#fcfaf7]"
                      >
                        <td className="border-r border-[#eee4d9] px-4 py-4">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/users/${user.USER_ID}`)}
                            className="inline-flex text-[#0b79c9] transition hover:text-[#095d99]"
                            aria-label={`View ${user.USER_NAME}`}
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                        <td className="border-r border-[#eee4d9] px-4 py-4">
                          {user.USER_NAME || "-"}
                        </td>
                        <td className="border-r border-[#eee4d9] px-4 py-4">
                          {user.OFFICER_ID || "-"}
                        </td>
                        <td className="border-r border-[#eee4d9] px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusClass}`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="border-r border-[#eee4d9] px-4 py-4">
                          {user.Role || "-"}
                        </td>
                        <td className="px-4 py-4">
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
                    <td className="px-4 py-8 text-center" colSpan="6">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c2118]/35 p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-[#d8ccbe] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,245,239,0.98)_100%)] shadow-[0_30px_90px_rgba(61,41,18,0.22)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(193,173,144,0.16)_0%,rgba(193,173,144,0.05)_34%,transparent_65%)]" />

            <div className="relative border-b border-[#eadfd2] px-5 py-4">
              <button
                type="button"
                onClick={closeCreateModal}
                className="absolute right-5 top-5 text-[#5d5044] transition hover:text-[#1f1a15]"
                aria-label="Close create user modal"
              >
                <X size={18} />
              </button>

              <h2 className="text-xl font-semibold text-[#2a221b]">Add User</h2>
            </div>

            <form onSubmit={handleCreateUser} className="relative px-5 py-6">
              <div className="grid gap-4">
                <div>
                  <label className="mb-1 block text-sm text-[#5f564d]">
                    Login Type
                  </label>
                  <select
                    name="loginType"
                    value={formData.loginType}
                    onChange={handleFormChange}
                    className="w-full rounded border border-[#9b8f82] bg-white px-3 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                  >
                    <option value="Member">Member</option>
                    <option value="Non Member">Non Member</option>
                  </select>
                </div>

                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleFormChange}
                  maxLength={50}
                  placeholder="First Name"
                  className="w-full rounded border border-[#9b8f82] bg-white px-3 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />

                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleFormChange}
                  maxLength={50}
                  placeholder="Last Name"
                  className="w-full rounded border border-[#9b8f82] bg-white px-3 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />

                <input
                  type="text"
                  name="userName"
                  value={formData.userName}
                  onChange={handleFormChange}
                  maxLength={50}
                  placeholder="User Name"
                  className="w-full rounded border border-[#9b8f82] bg-white px-3 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />

                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  minLength={6}
                  placeholder="Password"
                  className="w-full rounded border border-[#9b8f82] bg-white px-3 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />

                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleFormChange}
                  minLength={6}
                  placeholder="Confirm Password"
                  className="w-full rounded border border-[#9b8f82] bg-white px-3 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  maxLength={100}
                  placeholder="Email"
                  className="w-full rounded border border-[#9b8f82] bg-white px-3 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />

                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleFormChange}
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                  placeholder="Phone Number"
                  className="w-full rounded border border-[#9b8f82] bg-white px-3 py-3 text-[#241d17] outline-none transition focus:border-[#8c631f]"
                />
              </div>

              {formError ? (
                <p className="mt-4 text-sm font-medium text-[#b04444]">
                  {formError}
                </p>
              ) : null}

              {formSuccess ? (
                <p className="mt-4 text-sm font-medium text-[#2f7a3f]">
                  {formSuccess}
                </p>
              ) : null}

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-[#6f931f] px-5 py-3 font-semibold text-white transition hover:bg-[#5d7c1a] disabled:cursor-not-allowed disabled:bg-[#9cac74]"
                >
                  <PlusCircle size={18} />
                  {saving ? "Creating..." : "Create"}
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

            <div className="relative flex items-center justify-between border-b border-[#eadfd2] px-6 py-5">
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

            <div className="relative p-6">
              <div className="rounded-[14px] border border-[#e5dbd0] bg-white/90 p-4 shadow-[0_12px_30px_rgba(61,41,18,0.12)] sm:p-6">
                <div className="mb-6 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTemplateDownload}
                    className="rounded-md bg-[#3f3935] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#302b28]"
                  >
                    Sample Template
                  </button>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm text-[#5f564d]">
                      Upload File:
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleUploadFileChange}
                      className="block w-full rounded-md border border-dashed border-[#9b8f82] bg-white px-3 py-3 text-[#241d17] file:mr-4 file:rounded file:border-0 file:bg-transparent file:text-base"
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
                      className="rounded-md bg-[#3f3935] px-10 py-3 text-xl font-semibold text-white transition hover:bg-[#302b28] disabled:cursor-not-allowed disabled:bg-[#8f8883]"
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
