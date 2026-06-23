const BarStatusService = require('../services/BarStatusService')

const getBarStatus = async (req, res) => {
    try {
        const data = await BarStatusService.getBarStatus();

        return res.status(200).json({
            success: true,
            data,
        });
    }
    catch (error) {
        //   console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}


const updateBarStatus = async (req, res) => {
    try {
        const { status } = req.body;

        await BarStatusService.updateBarStatus({
            status,
            updatedBy:
                req.user?.USER_NAME ||
                req.user?.userName ||
                "SYSTEM",
        })

        return res.status(200).json({
            success: true,
            message: "Bar status updated successfully",
        });
    }
    catch (error) {
        console.error(error);

        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}


module.exports = {
  getBarStatus,
  updateBarStatus,
};