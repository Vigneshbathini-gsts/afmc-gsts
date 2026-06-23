const BarStatusService = require(
  "../services/BarStatusService"
);

const EXEMPT_ROLES = [10, 40];

const barStatusMiddleware = async (
  req,
  res,
  next
) => {
  try {
    const barStatus =
      await BarStatusService.getBarStatus();

    if (!barStatus) {
      return next();
    }

    const roleId = Number(
      req.user?.ROLE_ID ||
      req.user?.roleId ||
      0
    );

    const isBarClosed =
      barStatus.bar_status ===
      "Bar Is Close";

    const isExempt =
      EXEMPT_ROLES.includes(roleId);

    if (
      isBarClosed &&
      !isExempt
    ) {
      return res.status(403).json({
        success: false,
        code: "BAR_CLOSED",
        message: "Bar is closed",
      });
    }

    next();
  } catch (error) {
    console.error(
      "Bar status middleware:",
      error
    );

    next();
  }
};

module.exports = barStatusMiddleware;
