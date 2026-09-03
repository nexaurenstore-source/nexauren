-- Remove the original placeholder catalog rows if migration 0001 was applied before real catalog data is added.
DELETE FROM store_products;
