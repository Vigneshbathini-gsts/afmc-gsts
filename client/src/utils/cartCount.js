export const isFreeCartItem = (item) => {
    if (!item) return false;

    return Boolean(
        item.isFreeItem ??
        item.is_free_item ??
        item.isFree ??
        item.is_free
    ) || (
        Number(item.price ?? item.unitPrice ?? item.unit_price ?? 0) === 0 &&
        Number(item.subtotal ?? item.total ?? item.lineTotal ?? 0) === 0
    );
};

export const getCartCount = (items) =>
    (Array.isArray(items) ? items : []).filter((item) => !isFreeCartItem(item)).length;