import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { profitAPI } from "../../services/api";

const categoryOptions = ["Liquor", "Snacks"];

export default function ProfitManagement() {
    const navigate = useNavigate();
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [memberForm, setMemberForm] = useState({
        category: "Liquor",
        profit: "",
        foodPrCharges: "",
    });

    const [nonMemberForm, setNonMemberForm] = useState({
        category: "Liquor",
        profit: "",
        prCharges: "",
    });

    const fetchReport = async () => {
        try {
            setLoading(true);
            const res = await profitAPI.getProfitData();
            console.log("Report data:", res.data);
            setReportData(res.data.data || []);
        } catch (error) {
            console.error("Error fetching pricing report:", error);
            alert("Failed to load pricing report");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    const handleMemberChange = (e) => {
        setMemberForm({ ...memberForm, [e.target.name]: e.target.value });
    };

    const handleNonMemberChange = (e) => {
        setNonMemberForm({ ...nonMemberForm, [e.target.name]: e.target.value });
    };

    const handleMemberSubmit = async (e) => {
        e.preventDefault();

        try {
            await profitAPI.updateMemberPricing({
                category: memberForm.category,
                profit: Number(memberForm.profit),
                foodPrCharges:
                    memberForm.category === "Snacks"
                        ? Number(memberForm.foodPrCharges || 0)
                        : 0,
            });

            alert("Member pricing updated successfully");
            setMemberForm({
                category: "Liquor",
                profit: "",
                foodPrCharges: "",
            });
            fetchReport();
        } catch (error) {
            console.error(error);
            alert(error?.response?.data?.message || "Failed to update member pricing");
        }
    };

    const handleNonMemberSubmit = async (e) => {
        e.preventDefault();

        try {
            await profitAPI.updateNonMemberPricing({
                category: nonMemberForm.category,
                profit: Number(nonMemberForm.profit),
                prCharges:
                    nonMemberForm.category === "Snacks"
                        ? Number(nonMemberForm.prCharges || 0)
                        : 0,
            });

            alert("Non-member pricing updated successfully");
            setNonMemberForm({
                category: "Liquor",
                profit: "",
                prCharges: "",
            });
            fetchReport();
        } catch (error) {
            console.error(error);
            alert(
                error?.response?.data?.message || "Failed to update non-member pricing"
            );
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
            <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

            <div className="p-6 md:p-8 relative z-10">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                    <h1 className="text-2xl font-semibold text-afmc-maroon">
                        Profit Management
                    </h1>
                    <button
                        type="button"
                        onClick={() => navigate("/admin/dashboard")}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow hover:shadow-md border border-afmc-gold/30 text-gray-700 hover:text-afmc-maroon hover:bg-afmc-maroon/5 transition"
                    >
                        <FaArrowLeft />
                        Go To Dashboard
                    </button>
                </div>

                <div className="bg-white/80 border border-afmc-gold/15 rounded-3xl shadow-xl backdrop-blur-sm p-5 md:p-6 mb-6">
                    <div className="mb-5 md:mb-6 h-1 w-full rounded-full bg-gradient-to-r from-afmc-maroon via-afmc-gold to-afmc-maroon2" />

                    <div className="grid md:grid-cols-2 gap-5 md:gap-6">
                        {/* Member Pricing */}
                        <form
                            onSubmit={handleMemberSubmit}
                            className="bg-white/70 border border-white/60 rounded-3xl shadow-lg backdrop-blur-sm p-5"
                        >
                            <h2 className="text-lg font-semibold text-slate-700 mb-3">
                                Member Profit Setup
                            </h2>

                            <div className="mb-3">
                                <label className="block mb-1 text-sm font-medium text-slate-700">
                                    Category
                                </label>
                                <select
                                    name="category"
                                    value={memberForm.category}
                                    onChange={handleMemberChange}
                                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                                >
                                    {categoryOptions.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-3">
                                <label className="block mb-1 text-sm font-medium text-slate-700">
                                    Profit
                                </label>
                                <input
                                    type="number"
                                    name="profit"
                                    value={memberForm.profit}
                                    onChange={handleMemberChange}
                                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                                    required
                                    min="0"
                                />
                            </div>

                            {memberForm.category === "Snacks" && (
                                <div className="mb-3">
                                    <label className="block mb-1 text-sm font-medium text-slate-700">
                                        Food PR Charges
                                    </label>
                                    <input
                                        type="number"
                                        name="foodPrCharges"
                                        value={memberForm.foodPrCharges}
                                        onChange={handleMemberChange}
                                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                                        min="0"
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                className="px-6 py-3 rounded-2xl bg-afmc-maroon hover:bg-afmc-maroon2 text-white text-sm font-semibold shadow hover:shadow-md transition"
                            >
                                Update Member
                            </button>
                        </form>

                        {/* Non Member Pricing */}
                        <form
                            onSubmit={handleNonMemberSubmit}
                            className="bg-white/70 border border-white/60 rounded-3xl shadow-lg backdrop-blur-sm p-5"
                        >
                            <h2 className="text-lg font-semibold text-slate-700 mb-3">
                                Non-Member Profit Setup
                            </h2>

                            <div className="mb-3">
                                <label className="block mb-1 text-sm font-medium text-slate-700">
                                    Category
                                </label>
                                <select
                                    name="category"
                                    value={nonMemberForm.category}
                                    onChange={handleNonMemberChange}
                                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                                >
                                    {categoryOptions.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-3">
                                <label className="block mb-1 text-sm font-medium text-slate-700">
                                    Non-Member Profit
                                </label>
                                <input
                                    type="number"
                                    name="profit"
                                    min="0"
                                    value={nonMemberForm.profit}
                                    onChange={handleNonMemberChange}
                                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                                    required
                                />
                            </div>

                            {nonMemberForm.category === "Snacks" && (
                                <div className="mb-3">
                                    <label className="block mb-1 text-sm font-medium text-slate-700">
                                        PR Charges
                                    </label>
                                    <input
                                        type="number"
                                        name="prCharges"
                                        min="0"
                                        value={nonMemberForm.prCharges}
                                        onChange={handleNonMemberChange}
                                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                className="px-6 py-3 rounded-2xl bg-[#5b5b5b] text-white text-sm font-semibold shadow hover:shadow-md transition"
                            >
                                Update Non-Member
                            </button>
                        </form>
                    </div>
                </div>

                {/* Report Section */}
                <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-700 mb-3">
                        Profit Report
                    </h2>

                    {loading ? (
                        <p className="text-sm text-slate-600">Loading report...</p>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                                                Category
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                                                Member Profit
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                                                Food PR Charges
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                                                Non-Member Profit
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                                                PR Charges
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.length > 0 ? (
                                            reportData.map((row, index) => (
                                                <tr
                                                    key={index}
                                                    className="border-t border-gray-100 hover:bg-gray-50"
                                                >
                                                    <td className="px-4 py-3 capitalize">
                                                        {row.category_name}
                                                    </td>
                                                    <td className="px-4 py-3">{row.PROFIT}</td>
                                                    <td className="px-4 py-3">{row.FOOD_PR_CHARGES}</td>
                                                    <td className="px-4 py-3">{row.NON_MEMBER_PROFIT}</td>
                                                    <td className="px-4 py-3">{row.PR_CHARGES}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr className="border-t border-gray-100">
                                                <td
                                                    colSpan="5"
                                                    className="px-4 py-6 text-center text-gray-500"
                                                >
                                                    No records found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
