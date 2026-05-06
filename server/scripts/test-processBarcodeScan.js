const assert = require("assert");
const path = require("path");

const dbModulePath = path.resolve(__dirname, "../config/db.js");

function createMockConnection({ handlers }) {
  const state = {
    beginCalled: false,
    commitCalled: false,
    rollbackCalled: false,
    releaseCalled: false,
    queries: [],
  };

  const connection = {
    async beginTransaction() {
      state.beginCalled = true;
    },
    async query(sql, params) {
      state.queries.push({ sql, params });
      const handler = handlers.find((entry) => sql.includes(entry.match));
      if (!handler) {
        throw new Error(`No mock handler for query: ${sql}`);
      }
      const result = await handler.reply({ sql, params, state });
      return Array.isArray(result) ? result : [result];
    },
    async commit() {
      state.commitCalled = true;
    },
    async rollback() {
      state.rollbackCalled = true;
    },
    release() {
      state.releaseCalled = true;
    },
  };

  return { connection, state };
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function loadControllerWithPool(pool) {
  delete require.cache[dbModulePath];
  require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: pool,
  };

  const controllerPath = path.resolve(__dirname, "../controllers/KitchenOrdersController.js");
  delete require.cache[controllerPath];
  return require(controllerPath);
}

async function runSuccessScenario() {
  const { connection, state } = createMockConnection({
    handlers: [
      {
        match: "FROM xxafmc_stock_out xso",
        reply: () => [[{
          ITEM_CODE: "1001",
          STOCK_QUANTITY: 10,
          UNIT_PRICE: 120,
          ac_unit: "peg",
          PEGS: 4,
          BARCODE: "BC-001",
          CATEGORY_ID: 14,
          ITEM_NAME: "Whisky",
          SUB_CATEGORY: 14,
        }]],
      },
      {
        match: "FROM (\n         SELECT inventory_item_code",
        reply: () => [[{ inventory_item_code: "2001" }]],
      },
      {
        match: "SELECT inventory_item_code\n        FROM xxafmc_cocktails_mocktails_details",
        reply: () => [[]],
      },
      {
        match: "SELECT SUM(quantity) AS total_quantity",
        reply: () => [[{ total_quantity: 2 }]],
      },
      {
        match: "SELECT DISTINCT xu.ROLE_ID",
        reply: () => [[{ ROLE_ID: 20 }]],
      },
      {
        match: "SELECT PROFIT, NON_MEMBER_PROFIT",
        reply: () => [[{ PROFIT: 20, NON_MEMBER_PROFIT: 30 }]],
      },
      {
        match: "SELECT PR_CHARGES, FOOD_PR_CHARGES",
        reply: () => [[{ PR_CHARGES: 5, FOOD_PR_CHARGES: 7 }]],
      },
      {
        match: "SELECT subcategory\n  FROM xxafmc_order_details",
        reply: () => [[{ subcategory: 14 }]],
      },
      {
        match: "SELECT item_id, price",
        reply: () => [[]],
      },
      {
        match: "SELECT unit_price FROM xxafmc_stock_out",
        reply: () => [[{ unit_price: 120 }]],
      },
      {
        match: "SELECT item_code, item_name, quantity AS total_quantity, inventory_item_code, Mix",
        reply: () => [[{
          item_code: "1001",
          item_name: "Whisky",
          total_quantity: 2,
          inventory_item_code: "2001",
          Mix: "MO",
        }]],
      },
    ],
  });

  const pool = {
    async getConnection() {
      return connection;
    },
  };

  const controller = loadControllerWithPool(pool);
  const req = {
    body: {
      ORDERNUMBER: "ORD-1",
      BARCODE: "BC-001",
      QUANTITY: 1,
      KITCHEN: "Kitchen",
    },
    user: { username: "tester" },
    session: {},
  };
  const res = createRes();

  await controller.processBarcodeScan(req, res);

  if (res.statusCode !== 201) {
    throw new Error(`Unexpected status ${res.statusCode}: ${JSON.stringify(res.body)}`);
  }

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.itemCode, "1001");
  assert.ok(res.body.data.calculatedPrice);
  assert.strictEqual(req.session["scannedItems_ORD-1_tester"].length, 1);
  assert.strictEqual(req.session["scannedItems_ORD-1_tester"][0].scanQuantity, 1);
  assert.strictEqual(state.beginCalled, true);
  assert.strictEqual(state.commitCalled, true);
  assert.strictEqual(state.rollbackCalled, false);
  assert.strictEqual(state.releaseCalled, true);
}

async function runStandardRecipeCapScenario() {
  const { connection, state } = createMockConnection({
    handlers: [
      {
        match: "FROM xxafmc_stock_out xso",
        reply: () => [[{
          ITEM_CODE: "100",
          STOCK_QUANTITY: 100,
          UNIT_PRICE: 18.9,
          ac_unit: "peg",
          PEGS: 1,
          BARCODE: "SPR-1",
          CATEGORY_ID: 10,
          ITEM_NAME: "Sprite 250 ML",
          SUB_CATEGORY: 10,
          PROFIT: 0,
          NON_MEMBER_PROFIT: 0,
          PR_CHARGES: 0,
          FOOD_PR_CHARGES: 0,
        }]],
      },
      {
        match: "FROM (\n         SELECT inventory_item_code",
        reply: () => [[{ inventory_item_code: "9000" }]], // parent cocktail/mocktail item_code
      },
      {
        match: "SELECT inventory_item_code\n        FROM xxafmc_cocktails_mocktails_details",
        reply: () => [[{ inventory_item_code: "9000" }]],
      },
      {
        match: "SELECT DISTINCT xu.ROLE_ID",
        reply: () => [[{ ROLE_ID: 20 }]],
      },
      {
        match: "SELECT SUM(quantity) AS total_quantity",
        reply: () => [[{ total_quantity: 2 }]], // required total scans for Sprite in this order
      },
      {
        match: "SELECT subcategory\n  FROM xxafmc_order_details",
        reply: () => [[{ subcategory: 10 }]],
      },
      {
        match: "SELECT item_id, price",
        reply: () => [[]],
      },
      {
        match: "SELECT unit_price FROM xxafmc_stock_out",
        reply: () => [[{ unit_price: 18.9 }]],
      },
      {
        match: "SELECT item_code, item_name, quantity AS total_quantity, inventory_item_code, Mix",
        reply: () => [[{
          item_code: "100",
          item_name: "Sprite 250 ML",
          total_quantity: 2,
          inventory_item_code: "9000",
          Mix: "MO",
        }]],
      },
    ],
  });

  const pool = {
    async getConnection() {
      return connection;
    },
  };

  const controller = loadControllerWithPool(pool);

  const req = {
    body: {
      ORDERNUMBER: "ORD-STD",
      BARCODE: "SPR-1",
      QUANTITY: 1,
      KITCHEN: "Bar",
    },
    user: { username: "tester" },
    session: {
      "scannedItems_ORD-STD_tester": [
        { barcode: "SPR-A", parentItem: "9000", itemCode: "100", scanQuantity: 1 },
        { barcode: "SPR-B", parentItem: "9000", itemCode: "100", scanQuantity: 1 },
      ],
    },
  };
  const res = createRes();

  await controller.processBarcodeScan(req, res);

  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.message, /morethan Order quantity/i);
  assert.strictEqual(state.commitCalled, false);
  assert.strictEqual(state.rollbackCalled, true);
  assert.strictEqual(state.releaseCalled, true);
}

async function runDuplicateBottleScenario() {
  const { connection, state } = createMockConnection({
    handlers: [
      {
        match: "FROM xxafmc_stock_out xso",
        reply: () => [[{
          ITEM_CODE: "1001",
          STOCK_QUANTITY: 10,
          UNIT_PRICE: 120,
          ac_unit: "Nos",
          PEGS: 1,
          BARCODE: "BC-001",
          CATEGORY_ID: 10,
          ITEM_NAME: "Beer",
          SUB_CATEGORY: 10,
        }]],
      },
      {
        match: "SELECT inventory_item_code FROM (",
        reply: () => [[{ inventory_item_code: "1001" }]],
      },
      {
        match: "SELECT DISTINCT xu.ROLE_ID",
        reply: () => [[{ ROLE_ID: 20 }]],
      },
      {
        match: "SELECT SUM(quantity) AS total_quantity",
        reply: () => [[{ total_quantity: 2 }]],
      },
    ],
  });

  const pool = {
    async getConnection() {
      return connection;
    },
  };

  const controller = loadControllerWithPool(pool);
  const req = {
    body: {
      ORDERNUMBER: "ORD-2",
      BARCODE: "BC-001",
      QUANTITY: 1,
      KITCHEN: "Bar",
    },
    user: { username: "tester" },
    session: {
      "scannedItems_ORD-2_tester": [{
        barcode: "BC-001",
        parentItem: "1001",
        itemCode: "1001",
        scanQuantity: 1,
      }],
    },
  };
  const res = createRes();

  await controller.processBarcodeScan(req, res);

  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.message, /Duplicate bottle scan/);
  assert.strictEqual(state.commitCalled, false);
  assert.strictEqual(state.rollbackCalled, true);
  assert.strictEqual(state.releaseCalled, true);
}

async function runKitchenMismatchScenario() {
  const { connection, state } = createMockConnection({
    handlers: [
      {
        match: "FROM xxafmc_stock_out xso",
        reply: () => [[{
          ITEM_CODE: "5001",
          STOCK_QUANTITY: 5,
          UNIT_PRICE: 50,
          ac_unit: "Nos",
          PEGS: 1,
          BARCODE: "BC-KITCHEN",
          CATEGORY_ID: 14,
          ITEM_NAME: "Paneer Tikka",
          SUB_CATEGORY: 1,
        }]],
      },
    ],
  });

  const pool = {
    async getConnection() {
      return connection;
    },
  };

  const controller = loadControllerWithPool(pool);
  const req = {
    body: {
      ORDERNUMBER: "ORD-3",
      BARCODE: "BC-KITCHEN",
      QUANTITY: 1,
      KITCHEN: "Bar",
    },
    user: { username: "tester" },
    session: {},
  };
  const res = createRes();

  await controller.processBarcodeScan(req, res);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.message, "Scanned Barcode is for Kitchen");
  assert.strictEqual(state.commitCalled, false);
  assert.strictEqual(state.rollbackCalled, true);
  assert.strictEqual(state.releaseCalled, true);
}

async function main() {
  const tests = [
    ["success path", runSuccessScenario],
    ["standard recipe cap", runStandardRecipeCapScenario],
    ["duplicate Nos scan", runDuplicateBottleScenario],
    ["kitchen/bar mismatch", runKitchenMismatchScenario],
  ];

  for (const [name, testFn] of tests) {
    await testFn();
    console.log(`PASS ${name}`);
  }
}

main().catch((error) => {
  console.error("FAIL processBarcodeScan test harness");
  console.error(error.stack || error.message);
  process.exit(1);
});
