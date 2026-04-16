const pool = require("../config/db");

exports.getInventory = async (itemCode, subCategory) => {
    const query = `
SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image, 
    MIN(inv.item_id) AS item_id,

    (
        SELECT 
            CASE 
                WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
                ELSE NULL
            END
        FROM xxafmc_stock_out xso
        WHERE xso.item_code = inv.item_code
        GROUP BY xso.item_code
    ) AS stock_status

FROM xxafmc_inventory inv

WHERE 
    inv.item_code IN (
        SELECT DISTINCT item_code 
        FROM xxafmc_stock_out 
        WHERE item_code = inv.item_code
    )

    AND inv.category_id = 10
    AND inv.sub_category IN (4, 6, 9, 18)
    AND inv.item_code = IFNULL(NULL, inv.item_code)
    AND inv.sub_category = IFNULL(NULL, inv.sub_category)

GROUP BY 
    inv.item_code, 
    inv.item_name, 
    inv.image

ORDER BY 
    item_id ASC`;

    const [rows] = await pool.execute(query, [itemCode, subCategory]);
    return rows;
};

//      SELECT
//     inv.item_code,
//     inv.item_name,
//     inv.image,
//     inv.item_id,

//     (
//         SELECT
//             CASE
//                 WHEN IFNULL(SUM(xso.stock_quantity), 0) = 0 THEN 'Out Of Stock'
//                 ELSE NULL
//             END
//         FROM xxafmc_stock_out xso
//         WHERE xso.item_code = inv.item_code
//         GROUP BY xso.item_code
//     ) AS stock_status

// FROM xxafmc_inventory inv

// WHERE
//     inv.item_code IN (
//         SELECT DISTINCT item_code
//         FROM xxafmc_stock_out
//         WHERE item_code = inv.item_code
//     )

//     AND inv.category_id = 10
//     AND inv.sub_category IN (4, 6, 9, 18)

//     -- Replace with actual values or NULL
//     AND (inv.item_code = IFNULL(NULL, inv.item_code))
//     AND (inv.sub_category = IFNULL(NULL, inv.sub_category))

// ORDER BY
//     inv.item_id ASC

exports.fetchMocktail = async (itemcode) => {
    const query = `
    SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id
  
FROM 
    xxafmc_inventory inv
WHERE 1=1
    AND inv.category_id = 10
    AND inv.sub_category IN (14)
    AND inv.item_code = IFNULL(?, inv.item_code)
ORDER BY 
    inv.item_id ASC`;

    const [row] = await pool.execute(query, [itemcode]);
    return row;
};

exports.Snacksveg = async (itemcode, subcategory) => {
    const query = `
       select inv.item_code,
   inv.item_name,
   inv.image ,
   inv.item_id,
     (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
from xxafmc_inventory inv
where inv.item_code in 
(select xso.item_code 
from xxafmc_stock_out xso
 where xso.item_code =inv.item_code)
and inv.category_id = 14
and inv.sub_category = 10
and inv.item_code =IFNULL(?,inv.item_code)
order by inv.item_id asc;`;
    
    const [row] = await pool.execute(query, [itemcode, subcategory]);
    return row
};



exports.Snacknonveg = async (itemcode) => {
    const query = ` select inv.item_code,
   inv.item_name,
   inv.image ,
   inv.item_id,
     (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
from xxafmc_inventory inv
where inv.item_code in 
(select xso.item_code 
from xxafmc_stock_out xso 
where xso.item_code =inv.item_code)
and inv.category_id = 14
and inv.sub_category = 7
and inv.item_code =IFNULL(null,inv.item_code)
order by inv.item_id asc;
    `

    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}







exports.Drinkhardbeer = async (itemcode) => {
    const query = `SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id,
    (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
FROM 
    xxafmc_inventory inv
WHERE 
    (inv.item_code IN (
        SELECT DISTINCT xso.item_code 
        FROM xxafmc_stock_out xso 
        WHERE xso.item_code = inv.item_code
    ) )
    AND inv.category_id = 10
    AND inv.sub_category IN (1)
    AND inv.item_code = IFNULL(?, inv.item_code)
ORDER BY 
    inv.item_id ASC;`
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}


exports.Drinkhardbrandy = async (itemcode) => {
    const query = `SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id,
    (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
FROM 
    xxafmc_inventory inv
WHERE 
    (inv.item_code IN (
        SELECT DISTINCT xso.item_code 
        FROM xxafmc_stock_out xso 
        WHERE xso.item_code = inv.item_code
    ) )
    AND inv.category_id = 10
    AND inv.sub_category IN (2)
    AND inv.item_code = IFNULL(null, inv.item_code)
ORDER BY 
    inv.item_id ASC;
    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}



exports.Drinkhardbreezer = async (itemcode) => {
    const query = `SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id,
    (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
FROM 
    xxafmc_inventory inv
WHERE 
    (inv.item_code IN (
        SELECT DISTINCT xso.item_code 
        FROM xxafmc_stock_out xso 
        WHERE xso.item_code = inv.item_code
        
    ) )
    AND inv.category_id = 10
    AND inv.sub_category IN (3)
    AND inv.item_code = IFNULL(null, inv.item_code)
ORDER BY 
    inv.item_id ASC;

    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}


exports.Drinkhardvodka = async (itemcode) => {
    const query = `
    SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id,
    (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
FROM 
    xxafmc_inventory inv
WHERE 
    (inv.item_code IN (
        SELECT DISTINCT xso.item_code 
        FROM xxafmc_stock_out xso 
        WHERE xso.item_code = inv.item_code
        
    ) )
    AND inv.category_id = 10
    AND inv.sub_category IN (11)
    AND inv.item_code = IFNULL(null, inv.item_code)
ORDER BY 
    inv.item_id ASC;
    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}

exports.DrinkhardGin = async (itemcode) => {
    const query = `
   SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id,
    (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
FROM 
    xxafmc_inventory inv
WHERE 
    (inv.item_code IN (
        SELECT DISTINCT xso.item_code 
        FROM xxafmc_stock_out xso 
        WHERE xso.item_code = inv.item_code
       
    ) )
    AND inv.category_id = 10
    AND inv.sub_category IN (5)
    AND inv.item_code = IFNULL(null, inv.item_code)
   
ORDER BY 
    inv.item_id ASC;

    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}


exports.DrinkhardRum = async (itemcode) => {
    const query = `
   SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id,
    (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
FROM 
    xxafmc_inventory inv
WHERE 
    (inv.item_code IN (
        SELECT DISTINCT xso.item_code 
        FROM xxafmc_stock_out xso 
        WHERE xso.item_code = inv.item_code
        
    ) )
    AND inv.category_id = 10
    AND inv.sub_category IN (8)
    AND inv.item_code = IFNULL(null, inv.item_code)
   
ORDER BY 
    inv.item_id ASC;


    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}


exports.DrinkhardWhisky = async (itemcode) => {
    const query = `
SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id,
    (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
FROM 
    xxafmc_inventory inv
WHERE 
    (inv.item_code IN (
        SELECT DISTINCT xso.item_code 
        FROM xxafmc_stock_out xso 
        WHERE xso.item_code = inv.item_code
    ) )
   
    AND inv.category_id = 10
    AND inv.sub_category IN (12)
    AND inv.item_code = IFNULL(null, inv.item_code)
  
ORDER BY 
    inv.item_id ASC;
    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}



exports.DrinkhardWine = async (itemcode) => {
    const query = `
        	SELECT 
		inv.item_code, 
		inv.item_name, 
		inv.image,
		inv.item_id,
		(SELECT 
			CASE 
				WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
				ELSE NULL
			END AS stock_status
		FROM xxafmc_stock_out xso
		WHERE xso.item_code = inv.item_code
		GROUP BY xso.item_code) AS stock_status
	FROM 
		xxafmc_inventory inv
	WHERE 
		(inv.item_code IN (
			SELECT DISTINCT xso.item_code 
			FROM xxafmc_stock_out xso 
			WHERE xso.item_code = inv.item_code
		) )
		AND inv.category_id = 10
		AND inv.sub_category IN (1310)
		AND inv.item_code = IFNULL(null, inv.item_code)
	  
	ORDER BY 
		inv.item_id ASC;

    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}


exports.DrinkhardLiquor = async (itemcode) => {
    const query = `

    SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id,
    (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
FROM 
    xxafmc_inventory inv
WHERE 
    (inv.item_code IN (
        SELECT DISTINCT xso.item_code 
        FROM xxafmc_stock_out xso 
        WHERE xso.item_code = inv.item_code
    ) )
  
    AND inv.category_id = 10
    AND inv.sub_category IN (16)
    AND inv.item_code = IFNULL(NULL, inv.item_code)
ORDER BY 
    inv.item_id ASC;
    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}


exports.DrinkhardTequila = async (itemcode) => {
    const query = `
    SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id,
    (SELECT 
        CASE 
            WHEN SUM(IFNULL(xso.stock_quantity, 0)) = 0 THEN 'Out Of Stock'
            ELSE NULL
        END AS stock_status
    FROM xxafmc_stock_out xso
    WHERE xso.item_code = inv.item_code
    GROUP BY xso.item_code) AS stock_status
FROM 
    xxafmc_inventory inv
WHERE 
    (inv.item_code IN (
        SELECT DISTINCT xso.item_code 
        FROM xxafmc_stock_out xso 
        WHERE xso.item_code = inv.item_code
    ) )
   
    AND inv.category_id = 10
    AND inv.sub_category IN (17)
    AND inv.item_code = IFNULL(null, inv.item_code)
ORDER BY 
    inv.item_id ASC;
    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}


exports.DrinkhardCocktail = async (itemcode) => {
    const query = `
        	SELECT 
    inv.item_code, 
    inv.item_name, 
    inv.image,
    inv.item_id
    
FROM 
    xxafmc_inventory inv
WHERE 1=1
    AND inv.category_id = 10
    AND inv.sub_category IN (15)
    AND inv.item_code = IFNULL(null, inv.item_code)
    
ORDER BY 
    inv.item_id ASC;
    `
    const [rows] = await pool.execute(query, [itemcode]);
    return rows
}


