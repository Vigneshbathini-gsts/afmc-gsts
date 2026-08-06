const pool = require("../config/db");

exports.getInventory = async (itemCode, subCategory) => {
    const query = `
    SELECT
        inv.item_code,
        inv.item_name,
        inv.image,
        inv.sub_category,
        inv.status,  -- Added status field
        sc.SUB_CATEGORY_NAME AS sub_category_name,
        MIN(inv.item_id) AS item_id,

        GREATEST(
            IFNULL(SUM(xso.STOCK_QUANTITY), 0) -
            IFNULL(MAX(srt.reserved_qty), 0),
            0
        ) AS available_qty,

        CASE
            WHEN GREATEST(
                IFNULL(SUM(xso.STOCK_QUANTITY), 0) -
                IFNULL(MAX(srt.reserved_qty), 0),
                0
            ) = 0
            THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status

    FROM xxafmc_inventory inv

    LEFT JOIN xxafmc_sub_categories sc
        ON sc.SUB_CATEGORY_ID = inv.sub_category

    INNER JOIN xxafmc_stock_out xso
        ON xso.ITEM_CODE = inv.item_code

    LEFT JOIN xxafmc_stock_reservation_totals srt
        ON srt.item_code = inv.item_code

    WHERE
        inv.category_id = 10
        AND inv.sub_category IN (4, 6, 9, 18)
        AND inv.item_code = IFNULL(?, inv.item_code)
        AND inv.sub_category = IFNULL(?, inv.sub_category)
        AND inv.status = 'ACTIVE'  -- Only show active items

    GROUP BY
        inv.item_code,
        inv.item_name,
        inv.image,
        inv.sub_category,
        inv.status,  -- Added to GROUP BY
        sc.SUB_CATEGORY_NAME

    ORDER BY item_id ASC
  `;

    const [rows] = await pool.execute(query, [itemCode, subCategory]);
    return rows;
};



exports.Snacksveg = async (itemcode, subcategory) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN COALESCE(NULLIF(inv.STOCK_QUANTITY, 0), SUM(IFNULL(xso.stock_quantity, 0)), 0) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      IFNULL(inv.STOCK_QUANTITY, 0) > 0
      OR EXISTS (SELECT 1 FROM xxafmc_stock_out xso2 WHERE xso2.item_code = inv.item_code)
    )
    AND inv.category_id = 14
    AND inv.sub_category = 10
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;

    const [row] = await pool.execute(query, [itemcode, subcategory]);
    return row;
};

exports.Snacknonveg = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE inv.item_code IN (
      SELECT xso.item_code
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
    )
    AND inv.category_id = 14
    AND inv.sub_category = 7
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;

    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.Drinkhardbeer = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (1)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.Drinkhardbrandy = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (2)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.Drinkhardbreezer = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (3)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.Drinkhardvodka = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (11)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.DrinkhardGin = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (5)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.DrinkhardRum = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (8)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.DrinkhardWhisky = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (12)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.DrinkhardWine = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (1310)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.DrinkhardLiquor = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (16)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};

exports.DrinkhardTequila = async (itemcode) => {
    const query = `
    SELECT
      inv.item_code,
      inv.item_name,
      inv.image,
      inv.item_id,
      inv.status,  -- Added status field
      (SELECT
          CASE
              WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
              ELSE NULL
          END AS stock_status
      FROM xxafmc_stock_out xso
      WHERE xso.item_code = inv.item_code
      GROUP BY xso.item_code) AS stock_status
    FROM xxafmc_inventory inv
    WHERE (
      inv.item_code IN (
        SELECT DISTINCT xso.item_code
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
      )
    )
    AND inv.category_id = 10
    AND inv.sub_category IN (17)
    AND inv.item_code = IFNULL(?, inv.item_code)
    AND inv.status = 'ACTIVE'  -- Only show active items
    ORDER BY inv.item_id ASC`;
    const [rows] = await pool.execute(query, [itemcode]);
    return rows;
};
exports.DrinkhardCocktail = async (itemcode) => {
    const query = `
    SELECT
    inv.item_code,
    inv.item_name,
    inv.image,
    inv.category_id,
    inv.sub_category,
    inv.item_id,
    (
        SELECT COALESCE(SUM(IFNULL(xso.stock_quantity, 0)), 0)
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
    ) AS stockQuantity,
    (
        SELECT
            CASE
                WHEN COALESCE(SUM(IFNULL(xso.stock_quantity, 0)), 0) = 0 THEN 'Out Of Stock'
                ELSE NULL
            END
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
    ) AS stock_status

FROM
    xxafmc_inventory inv
WHERE 1=1
    AND inv.category_id = 10
    AND inv.sub_category IN (14)
    AND inv.item_code = IFNULL(null, inv.item_code)

ORDER BY
    inv.item_id ASC;
    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}

exports.fetchMocktail = async (itemcode) => {
    const query = `
    SELECT
    inv.item_code,
    inv.item_name,
    inv.image,
    inv.category_id,
    inv.sub_category,
    inv.item_id,
    (
        SELECT COALESCE(SUM(IFNULL(xso.stock_quantity, 0)), 0)
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
    ) AS stockQuantity,
    (
        SELECT
            CASE
                WHEN COALESCE(NULLIF(inv.STOCK_QUANTITY, 0), COALESCE(SUM(IFNULL(xso.stock_quantity, 0)), 0), 0) = 0 THEN 'Out Of Stock'
                ELSE NULL
            END
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
    ) AS stock_status

FROM
    xxafmc_inventory inv
WHERE 1=1
    AND inv.category_id = 10
    AND inv.sub_category IN (15)
    AND inv.item_code = IFNULL(?, inv.item_code)
ORDER BY
    inv.item_id ASC`;

    const [row] = await pool.execute(query, [itemcode]);
    return row;
};