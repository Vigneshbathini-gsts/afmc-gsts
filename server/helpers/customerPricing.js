const normalizeLoginType = (loginType) =>
  String(loginType || "").trim().toUpperCase();

const hasRole = (roleId) => {
  const normalizedRoleId = Number(roleId);
  return Number.isFinite(normalizedRoleId) && normalizedRoleId > 0;
};

const usesMemberPricing = ({ roleId, loginType } = {}) => {
  const normalizedLoginType = normalizeLoginType(loginType);

  if (hasRole(roleId)) {
    return Number(roleId) === 20 && normalizedLoginType !== "NON MEMBER";
  }

  return normalizedLoginType !== "NON MEMBER";
};

const usesNonMemberPricing = (customer = {}) => !usesMemberPricing(customer);

module.exports = {
  normalizeLoginType,
  usesMemberPricing,
  usesNonMemberPricing,
};
