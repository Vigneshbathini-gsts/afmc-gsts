const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOrderStatusUpdatePayload } = require('../utils/orderEvents');

test('buildOrderStatusUpdatePayload returns minimal status payload', () => {
  const payload = buildOrderStatusUpdatePayload({
    orderNumber: '12345',
    status: 'Completed',
    paymentStatus: 'Paid',
  });

  assert.deepEqual(payload, {
    orderNumber: '12345',
    status: 'Completed',
    payment_status: 'Paid',
  });
});
