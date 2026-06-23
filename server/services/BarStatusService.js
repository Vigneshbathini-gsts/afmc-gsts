const BarStatusModel = require("../models/BarStatusModel");

const getBarStatus = async () => {
    return await BarStatusModel.getBarStatus();
};

const updateBarStatus = async ({
    status,
    updatedBy,
}) => {
    const allowedStatuses = [
        "Bar Is Open",
        "Bar Is Close",
    ];

    if (!allowedStatuses.includes(status)) {
        throw new Error("Invalid bar status");
    }

    return await BarStatusModel.updateBarStatus({
        status,
        updatedBy,
    });
};

module.exports = {
    getBarStatus,
    updateBarStatus,
};