const OrderDetailsModal = ({
  order,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white w-[700px] rounded-lg p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">
            Order Details
          </h2>

          <button onClick={onClose}>X</button>
        </div>

        <table className="w-full border-collapse border">
          <thead>
            <tr>
              <th className="border p-2">Item</th>
              <th className="border p-2">Qty</th>
              <th className="border p-2">Price</th>
              <th className="border p-2">Status</th>
            </tr>
          </thead>

          <tbody>
            {order.items.map((item) => (
              <tr key={item.order_line_id}>
                <td className="border p-2">
                  {item.item_name}
                </td>

                <td className="border p-2">
                  {item.quantity}
                </td>

                <td className="border p-2">
                  ₹ {item.subtotal}
                </td>

                <td className="border p-2">
                  {item.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-right mt-4 font-bold">
          Total: ₹ {order.total}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;