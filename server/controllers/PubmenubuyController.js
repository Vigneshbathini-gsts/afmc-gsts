const Pubmenubuyservice = require("../services/Pubmenubuyservice");


exports.PubmenubuyController = async (req, res) => {
    try {
        const { ORDER_NUMBER } = req.params;
        if (!ORDER_NUMBER) {
            return res.status(400).json({
                success: false,
                message: "ORDER_NUMBER is required",
            });
        }
        const data = await Pubmenubuyservice.Pubmenubuyservice(ORDER_NUMBER);
        res.status(200).json({
            success: true,
            message: "data",
            data
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "server error"
        });
    }
}
