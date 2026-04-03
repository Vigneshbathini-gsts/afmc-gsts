const roleRedirectMap = {
  10: "/admin/dashboard",
  20: "/attendant/dashboard",
  30: "/user/dashboard",
  40: {
    KITCHEN: "/kitchen/dashboard",
    BAR: "/bar/dashboard",
  },
};

function getRedirectPath(roleId, outletType = null) {
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