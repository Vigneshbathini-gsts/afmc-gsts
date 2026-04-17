-- Increase extra_data size to store full scan metadata (ingredients, pegs, etc.)
ALTER TABLE order_scan_collection
  MODIFY COLUMN extra_data LONGTEXT;

