const STORAGE_KEY = "afmc:attendantCustomer";

export function setSelectedAttendantCustomer(customer) {
  if (!customer) return;

  const memberId = customer.id ?? customer.memberId;
  if (!memberId) return;

  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      memberId,
      firstName: customer.first_name ?? customer.firstName ?? "",
      lastName: customer.last_name ?? customer.lastName ?? "",
      phoneNumber: customer.phone_number ?? customer.phoneNumber ?? "",
    })
  );
}

export function getSelectedAttendantCustomer() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function getSelectedAttendantCustomerPayload() {
  const customer = getSelectedAttendantCustomer();
  const memberId = Number(customer?.memberId);

  return Number.isFinite(memberId) && memberId > 0 ? { memberId } : {};
}

export function clearSelectedAttendantCustomer() {
  sessionStorage.removeItem(STORAGE_KEY);
}
