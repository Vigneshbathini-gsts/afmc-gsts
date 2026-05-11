CREATE TABLE IF NOT EXISTS xxafmc_cart_customization (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_id INT NOT NULL,
  ingredient_item_code INT NOT NULL,
  ingredient_name VARCHAR(255),
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  creation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cart_customization_cart_id (cart_id),
  INDEX idx_cart_customization_item_code (ingredient_item_code)
);
