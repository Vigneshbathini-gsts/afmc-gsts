// pages/invoice/InvoicePage.jsx

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import orderService from "../../services/orderService";

const InvoicePage = () => {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("orderNumber");

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInvoice();
  }, [orderNumber]);

  const loadInvoice = async () => {
    if (!orderNumber) {
      setError("Order number is required.");
      setLoading(false);
      return;
    }

    try {
      const response = await orderService.getInvoice(orderNumber);
      setInvoice(response.data.data);
    } catch (loadError) {
      console.log(loadError);
      setError("Unable to load invoice.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center">
        Loading...
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-10 text-center text-red-600">
        {error || "Invoice not found."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <div className="flex justify-between items-center border-b pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              AFMC Invoice
            </h1>

            <p className="text-gray-500 mt-2">
              Order #{invoice.orderNumber}
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl"
          >
            Download PDF
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-10">
          <div>
            <p className="text-gray-500 text-sm">
              Payment Method
            </p>

            <p className="font-semibold text-lg">
              {invoice.paymentMethod}
            </p>
          </div>

          <div>
            <p className="text-gray-500 text-sm">
              Payment Status
            </p>

            <p className="font-semibold text-lg">
              {invoice.paymentStatus}
            </p>
          </div>

          <div>
            <p className="text-gray-500 text-sm">
              Invoice Date
            </p>

            <p className="font-semibold text-lg">
              {invoice.invoiceDate}
            </p>
          </div>

          <div>
            <p className="text-gray-500 text-sm">
              Total Amount
            </p>

            <p className="font-semibold text-lg">
              ₹ {invoice.totalAmount}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-4 text-left">
                Item
              </th>

              <th className="border p-4 text-center">
                Quantity
              </th>

              <th className="border p-4 text-right">
                Price
              </th>

              <th className="border p-4 text-right">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td className="border p-4">
                  {item.ITEM_NAME}
                </td>

                <td className="border p-4 text-center">
                  {item.QUANTITY}
                </td>

                <td className="border p-4 text-right">
                  ₹ {item.PRICE}
                </td>

                <td className="border p-4 text-right">
                  ₹ {item.SUBTOTAL}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-8">
          <div className="w-80 bg-gray-50 border rounded-xl p-6">
            <div className="flex justify-between text-lg font-bold">
              <span>Total Amount</span>

              <span>
                ₹ {invoice.totalAmount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePage;