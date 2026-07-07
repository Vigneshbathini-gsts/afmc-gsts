const invoiceModel = require("../invoice/invoiceModel");
const { emitOrderStatusUpdate } = require("../../utils/orderEvents");

const fetchPaymentModes = async ({ roleId, loginType }) => {
  const normalizedLoginType = loginType?.trim().toUpperCase();


  // roleId = 30 normally blocks CREDIT
  // but MEMBER users should still get CREDIT

  if (roleId === 30 && normalizedLoginType !== "MEMBER") {
    return ["IMMEDIATE"];
  }

  return ["IMMEDIATE", "CREDIT"];
};

const processPayment = async ({
  orderNumber,
  paymentMode,
  paymentReference,
  createdBy,
}) => {
  const paymentStatus =
    paymentMode === "CREDIT"
      ? "Un Paid"
      : "Paid";

  await invoiceModel.updateInvoicePayment({
    orderNumber,
    paymentMode,
    paymentReference,
    paymentStatus,
    createdBy,
  });

  await emitOrderStatusUpdate(orderNumber, { payment_status: paymentStatus });

  return {
    orderNumber,
    paymentStatus,
  };
};

module.exports = {
  fetchPaymentModes,
  processPayment,
};
