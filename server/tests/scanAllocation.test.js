const test = require('node:test');
const assert = require('node:assert/strict');
const { buildScanEntriesForComponents } = require('../utils/scanAllocation');

test('buildScanEntriesForComponents creates a scan entry for each matching component', () => {
  const entries = buildScanEntriesForComponents({
    requestedQty: 1,
    components: [
      { item_code: '1001', item_name: 'Normal item', inventory_item_code: '2001', coll_qty: 1, Mix: 'I', order_line_id: 11 },
      { item_code: '1002', item_name: 'Mocktail ingredient', inventory_item_code: '2002', coll_qty: 1, Mix: 'MO', order_line_id: 12 },
    ],
    baseEntry: {
      barcode: 'ABC123',
      scannedAt: '2026-07-03T00:00:00.000Z',
      categoryId: 10,
      subCategory: 1,
      isFreeItem: false,
      pegs: 1,
      roleId: 4,
      acUnit: 'GLASS',
      itemPrice: 50,
      orderLineId: 99,
    },
  });

  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => ({ itemCode: entry.itemCode, scanQuantity: entry.scanQuantity })), [
    { itemCode: '1001', scanQuantity: 1 },
    { itemCode: '1002', scanQuantity: 1 },
  ]);
});
