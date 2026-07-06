function validateBottleScanRequest({ stockQuantity, alreadyScannedQty, requestedQty, barcode }) {
  const numericStock = Number(stockQuantity || 0);
  const numericAlreadyScanned = Number(alreadyScannedQty || 0);
  const numericRequestedQty = Number(requestedQty || 0);
  const remainingQty = Math.max(0, numericStock - numericAlreadyScanned);

  if (numericRequestedQty <= 0) {
    return {
      allowed: false,
      message: 'Error: Entered quantity is more than stock',
      remainingQty,
    };
  }

  if (remainingQty <= 0) {
    return {
      allowed: false,
      message: `Error: Duplicate bottle scan for ${barcode}`,
      remainingQty,
    };
  }

  if (numericRequestedQty > remainingQty) {
    return {
      allowed: false,
      message: 'Error: Entered quantity is more than stock',
      remainingQty,
    };
  }

  return {
    allowed: true,
    message: '',
    remainingQty,
  };
}

module.exports = {
  validateBottleScanRequest,
};
