const db = require("../config/db")

const getBarStatus = async()=>{

    const [rows] = await db.execute(
    `
     SELECT
        id,
        bar_status,
        active_flag,
        created_by,
        DATE_FORMAT(creation_date, '%Y-%m-%d %H:%i:%s') AS creation_date,
        last_updated_by,
        DATE_FORMAT(last_updated_date, '%Y-%m-%d %H:%i:%s') AS last_updated_date
      FROM xxafmc_mess_timings
      WHERE id = 1
    `
    ) ;

    return rows[0] || null;
}

const updateBarStatus = async({status,updatedBy})=>{
    const [result] = await db.execute(
        `UPDATE xxafmc_mess_timings
      SET
        bar_status = ?,
        last_updated_by = ?,
        last_updated_date = NOW()
      WHERE id = 1`,
      [status,updatedBy]
    );

    return result;
}

module.exports= {getBarStatus,updateBarStatus};
