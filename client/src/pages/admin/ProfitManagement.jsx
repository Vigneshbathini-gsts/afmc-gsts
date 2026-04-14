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
        <div className="p-4 min-h-screen bg-slate-100">
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => navigate("/admin/dashboard")}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-[#d70652] to-[#ff025e] hover:from-[#ff025e] hover:to-[#d70652] text-white font-medium rounded-lg shadow-md transition duration-300"
                >
                    <FaArrowLeft size={14} />
                    Back
                </button>
            </div>

            <h1 className="text-2xl font-bold text-slate-800 mb-4">
                Profit Management
            </h1>

            <div className="grid md:grid-cols-2 gap-4 mb-5">
                {/* Member Pricing */}
                <form
                    onSubmit={handleMemberSubmit}
                    className="bg-white rounded-xl shadow-sm p-4"
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
                            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
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
                                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md transition"
                    >
                        Update Member
                    </button>
                </form>

                {/* Non Member Pricing */}
                <form
                    onSubmit={handleNonMemberSubmit}
                    className="bg-white rounded-xl shadow-sm p-4"
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
                            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
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
                            value={nonMemberForm.profit}
                            onChange={handleNonMemberChange}
                            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
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
                                value={nonMemberForm.prCharges}
                                onChange={handleNonMemberChange}
                                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-md transition"
                    >
                        Update Non-Member
                    </button>
                </form>
            </div>

            {/* Report Section */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <h2 className="text-lg font-semibold text-slate-700 mb-3">
                    Profit Report
                </h2>

                {loading ? (
                    <p className="text-sm text-slate-600">Loading report...</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border border-slate-200 text-sm">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="border px-3 py-2 text-left">Category</th>
                                    <th className="border px-3 py-2 text-left">Member Profit</th>
                                    <th className="border px-3 py-2 text-left">
                                        Food PR Charges
                                    </th>
                                    <th className="border px-3 py-2 text-left">
                                        Non-Member Profit
                                    </th>
                                    <th className="border px-3 py-2 text-left">PR Charges</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.length > 0 ? (
                                    reportData.map((row, index) => (
                                        <tr key={index} className="hover:bg-slate-50">
                                            <td className="border px-3 py-2">{row.category_name}</td>
                                            <td className="border px-3 py-2">{row.PROFIT}</td>
                                            <td className="border px-3 py-2">
                                                {row.FOOD_PR_CHARGES}
                                            </td>
                                            <td className="border px-3 py-2">
                                                {row.NON_MEMBER_PROFIT}
                                            </td>
                                            <td className="border px-3 py-2">{row.PR_CHARGES}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan="5"
                                            className="border px-3 py-3 text-center text-slate-500"
                                        >
                                            No data found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}