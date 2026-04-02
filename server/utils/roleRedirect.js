const roleRedirectMap = {
  10: "/admin/dashboard",
  20: "/kitchen/dashboard",
  30: "/attendant/dashboard",
  40: "/user/dashboard",
};

function getRedirectPath(roleId) {
  return roleRedirectMap[Number(roleId)] || "/unauthorized";
}

module.exports = {getRedirectPath} ;