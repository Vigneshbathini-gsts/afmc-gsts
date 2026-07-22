import { isOutOfStock, resolveAvailableStockQuantity } from './stockValidation';

describe('resolveAvailableStockQuantity', () => {
  it('prefers the API stock even when a fallback value is zero', () => {
    expect(resolveAvailableStockQuantity(1, 0)).toBe(1);
  });

  it('falls back to the local stock when the API stock is missing', () => {
    expect(resolveAvailableStockQuantity(undefined, 5)).toBe(5);
  });

  it('keeps an explicit zero from the API as a valid value', () => {
    expect(resolveAvailableStockQuantity(0, 5)).toBe(0);
  });
});

describe('isOutOfStock', () => {
  it('treats explicit out-of-stock status as out of stock', () => {
    expect(isOutOfStock({ stockStatus: 'Out Of Stock' })).toBe(true);
  });

  it('treats zero available quantity as out of stock', () => {
    expect(isOutOfStock({ availableQuantity: 0 })).toBe(true);
  });

  it('treats stock issue messages as out of stock', () => {
    expect(isOutOfStock({ stockIssueMessage: 'Out of stock. Available quantity: 0' })).toBe(true);
  });

  it('keeps items with positive available quantity as in stock', () => {
    expect(isOutOfStock({ availableQuantity: 5, stockStatus: 'In Stock' })).toBe(false);
  });
});
