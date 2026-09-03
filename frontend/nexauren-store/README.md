# Nexauren Store

Nexauren Store is a separate marketplace experience intended to launch later at:

`https://nexaurenstory.com/nexauren-store/`

It is deliberately not added to the main Nexauren navigation yet.

## Data architecture

The Marketplace catalog uses a dedicated Cloudflare D1 database named `nexauren-marketplace`.

- `nexauren-db`: shared Nexauren identity, sessions, billing, subscriptions and credits
- `nexauren-tools`: tool-specific data
- `nexauren-marketplace`: Store catalog and, in later phases, carts, orders, entitlements, reviews and download records

The Store does not create a second user/login system. Authenticated Store operations reuse the existing Nexauren session from `nexauren-db`.

## Included in the foundation

- Dedicated Store header and navigation
- Home/marketplace landing experience
- 12 product categories
- Search
- Category, price, format and rating filters
- Sorting by relevance, newest, rating and price
- Responsive mobile filter/navigation experience
- Product cards
- Wishlist stored locally for the prototype
- Cart stored locally for the prototype
- Dedicated Store account page
- Library, orders, reviews, profile, settings and help sections ready for backend integration
- Free products, new arrivals, curated/popular picks and bundles sections
- Trust/information area
- Mobile-first responsive layout
- No public sales counters

## Important launch boundary

This foundation does not create fake orders, payments, balances, sales numbers or download entitlements. Checkout, verified purchases, secure digital-file delivery, orders/library persistence and Store account synchronization should be connected to the existing Nexauren backend during the launch phase.

The Store is intentionally isolated from the main Nexauren UI for now. The same Nexauren identity can be reused later without making the Store account page identical to the main platform account.

## Product discovery principles

Search and filters are designed around fast discovery, with applied-filter visibility and mobile-friendly controls. Category-specific filter expansion can be added as the real catalog grows.
