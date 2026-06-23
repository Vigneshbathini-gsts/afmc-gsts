const BarStatusModel = require("../models/BarStatusModel");

let cachedStatus = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

const getBarStatus = async () => {
    const now = Date.now();

    if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
        return cachedStatus;
    }

    cachedStatus = await BarStatusModel.getBarStatus();
    cachedAt = now;

    return cachedStatus;
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

    await BarStatusModel.updateBarStatus({
        status,
        updatedBy,
    });

    cachedStatus = await BarStatusModel.getBarStatus();
    cachedAt = Date.now();

    return cachedStatus;
};

module.exports = {
    getBarStatus,
    updateBarStatus,
};
