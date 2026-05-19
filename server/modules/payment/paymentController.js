// payment controller


const paymentService = require("./paymentService");
const {
  successResponse,
  errorResponse,
} = require("../../utils/responseHandler");

const getPaymentModes = async (req, res) => {
  try {
    const roleId = req.user.roleId;
    const loginType = req.user.loginType;

    const modes = await paymentService.fetchPaymentModes({ roleId, loginType });

    return successResponse(res, "Payment modes fetched", modes);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

const updatePayment = async (req, res) => {
  try {
    const paymentData = {
      ...req.body,
      createdBy: req.user?.username || req.user?.userName || "SYSTEM",
    };

    const response = await paymentService.processPayment(paymentData);

    return successResponse(res, "Payment updated", response);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

module.exports = {
  getPaymentModes,
  updatePayment,
};
