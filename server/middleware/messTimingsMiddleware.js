const MessTimingsService = require("../services/MessTimingsService");
const BarStatusService = require("../services/BarStatusService");

const EXEMPT_ROLES = [10, 40];

const messTimingsMiddleware = async (req, res, next) => {
  try {
    const roleId = Number(
      req.user?.ROLE_ID ||
      req.user?.roleId ||
      0
    );

    if (EXEMPT_ROLES.includes(roleId)) {
      return next();
    }

    const barStatus = await BarStatusService.getBarStatus();

    if (barStatus?.bar_status === "Bar Is Close") {
      return res.status(403).json({
        success: false,
        code: "BAR_CLOSED",
        message: "Bar is closed",
      });
    }

    const isOpen = await MessTimingsService.isMessOpen();

    if (!isOpen) {
      return res.status(403).json({
        success: false,
        code: "MESS_CLOSED",
        message: "Mess is currently closed.",
      });
    }

    next();
  } catch (error) {
    console.error("Mess Timings Middleware:", error);
    return res.status(503).json({
      success: false,
      code: "MESS_STATUS_UNAVAILABLE",
      message: "Mess status is temporarily unavailable. Please try again.",
    });
  }
};

module.exports = messTimingsMiddleware;