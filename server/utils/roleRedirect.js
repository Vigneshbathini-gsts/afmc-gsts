const roleRedirectMap = {
  10: "/admin/dashboard",
  30: "/attendant/register-member",
  20: "/user/dashboard",
  80: "/admin/dashboard",
  40: {
    KITCHEN: "/kitchen/dashboard",
    BAR: "/bar/dashboard",
  },
  
};

function getRedirectPath(roleId, outletType = null) {
  const loginType = arguments.length > 2 ? arguments[2] : null;
  const normalizedLoginType = String(loginType || "").trim().toUpperCase();

  // Special case: roleId 30 used for both attendant (Member) and end user (Non Member)
  if (Number(roleId) === 30 && normalizedLoginType === "NON MEMBER") {
    return "/user/dashboard";
  }

  const role = roleRedirectMap[Number(roleId)];

  if (!role) return "/unauthorized";

  if (typeof role === "string") {
    return role;
  }

  if (typeof role === "object") {
    return role[outletType?.toUpperCase()] || "/unauthorized";
  }

  return "/unauthorized";
}

module.exports = { getRedirectPath };


