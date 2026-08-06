const MessTimingsService = require("../services/MessTimingsService");

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
    next();
  }
};

module.exports = messTimingsMiddleware;