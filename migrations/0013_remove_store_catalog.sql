-- Remove the temporary Store catalog from the shared nexauren-db.
-- The real Marketplace catalog belongs to the dedicated nexauren-marketplace D1.

DROP TABLE IF EXISTS store_products;
