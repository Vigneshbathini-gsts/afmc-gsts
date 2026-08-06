const MessTimingsService = require("../services/MessTimingsService");

const getWeeklyTimings = async (req, res) => {
  try {
    const data = await MessTimingsService.getWeeklyTimings();

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Weekly Timings:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch weekly timings.",
    });
  }
};

const updateWeeklyTimings = async (req, res) => {
  try {
    const { timings } = req.body;

    const updatedBy =
      req.user?.LOGIN_ID ||
      req.user?.USERNAME ||
      req.user?.USER_NAME ||
      "SYSTEM";

    const data = await MessTimingsService.updateWeeklyTimings({
      timings,
      updatedBy,
    });

    return res.json({
      success: true,
      message: "Weekly timings updated successfully.",
      data,
    });
  } catch (error) {
    console.error("Update Weekly Timings:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getWeeklyTimings,
  updateWeeklyTimings,
};