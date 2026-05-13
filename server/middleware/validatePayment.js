module.exports = (req, res, next) => {
  const {
    paymentMode,
    paymentReference,
  } = req.body;

  if (
    paymentMode === "IMMEDIATE" &&
    (!paymentReference || !paymentReference.trim())
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Payment reference is required for immediate payments",
    });
  }

  next();
};