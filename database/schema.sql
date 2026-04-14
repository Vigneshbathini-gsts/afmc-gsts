-- AFMC Mess App schema starter
CREATE DATABASE IF NOT EXISTS afmc_mess;
USE afmc_mess;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS order_scan_collection (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collection_name VARCHAR(100) NOT NULL DEFAULT 'S_COLLECTION',
  order_number VARCHAR(100) NOT NULL,
  item_code VARCHAR(100),
  item_name VARCHAR(255),
  scan_quantity DECIMAL(18,4) DEFAULT 0,
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  item_price VARCHAR(255),
  barcode VARCHAR(255),
  inventory_item_code VARCHAR(100),
  extra_data LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_scan_order (collection_name, order_number),
  INDEX idx_order_scan_barcode (collection_name, barcode),
  INDEX idx_order_scan_item (collection_name, item_code)
);
