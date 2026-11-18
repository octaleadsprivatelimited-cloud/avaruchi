# Phase 2 catalogue reconciliation

The owner supplied **Aavaruchi Feedback phase 2.docx** and **Price list Master to post in website.xlsx** on 18 November 2026. The master workbook is the price source for this revision. The merchant confirmed that Non-Veg Pickles column B is the final customer 1 kg price and that all new packs should start with zero stock. The checked source rows, URL handles and pack prices are recorded in `catalogue-phase2-master.json`.

## Price and catalogue corrections

The 55 existing pack options covered by the master already matched its amounts when checked against the public catalogue. The migration reapplies those approved amounts once, with MRP equal to selling price. It matches product handle, pack title and weight; it does not retire other packs or change tax rates, stock, reservations, images or variant identities. Order snapshots remain unchanged.

Seven newly listed vegetarian products receive the workbook's 500 g and 1 kg options:

| Product | 500 g | 1 kg |
| --- | ---: | ---: |
| Kakarakaya Pickle (Karela) | ₹450 | ₹900 |
| Dry Mango Pickle (Sookha Aam) | ₹450 | ₹900 |
| Ginger Pickle | ₹450 | ₹900 |
| Mixed Veg Pickle | ₹450 | ₹900 |
| Mango Ginger Pickle | ₹450 | ₹900 |
| Flax Seed Karam Podi | ₹375 | ₹750 |
| Kura Karam Podi | ₹375 | ₹750 |

Sixteen non-vegetarian products are also added with **1 kg packs only**, using the merchant-confirmed column B prices:

| Product | 1 kg |
| --- | ---: |
| Chicken with Bone Pickle | ₹1,190 |
| Chicken Boneless Pickle | ₹1,650 |
| Gongura Chicken Pickle | ₹1,725 |
| Chicken Keema Pickle | ₹1,650 |
| Desi Chicken with Bone Pickle | ₹1,800 |
| Desi Chicken Boneless Pickle | ₹2,100 |
| Apollo Fish Boneless Pickle | ₹1,650 |
| Bocchi/Ravva Boneless Pickle | ₹1,800 |
| Koramenu Fish Pickle | ₹1,950 |
| Fresh Prawns Pickle | ₹2,100 |
| Gongura Prawns Pickle | ₹2,100 |
| Mutton Boneless Pickle | ₹2,700 |
| Mutton with Bone Pickle | ₹2,400 |
| Gongura Mutton Pickle | ₹2,700 |
| Boti Pickle | ₹1,800 |
| Gongura Boti Pickle | ₹1,800 |

The non-vegetarian range uses separate Chicken, Fish, Prawn, Mutton and Boti subcategories and an explicit Non-vegetarian diet specification. The import therefore covers **52 unique master products and 85 pack prices**, including **23 new products and 30 new packs**. With retained Minapa, the expected live catalogue has **53 active products** after Green Chilli is archived.

These are active catalogue entries with zero inventory. They cannot be purchased until the administrator records actual stock. They have no supplied product photo, so no unrelated image is assigned. Existing product images remain unchanged.

**Green Chilli Pickle** is archived reversibly, removing the unapproved ₹1.18 offer from sale. Its compare-at prices are reset to its saved selling prices. Product, variant, stock and order records are retained for admin correction and history.

Allam Avakaya retains its existing `/product/ginger-pickle` handle and ₹475/₹950 prices. The separate ₹450/₹900 Ginger Pickle gets `/product/traditional-ginger-pickle`; the older product is not repurposed.

The master lists Kura Podi at ₹350/₹700 and Kura Karam Podi at ₹375/₹750. They remain separate products.

## Source exceptions and merchant inputs

- **Non-Veg Pickles:** column B is merchant-confirmed for customer 1 kg prices. Column C is a reseller column and D–F are unlabelled; none of these are imported or used to infer 500 g packs.
- **Kakarayakaya Karam Podi** (Podis row 12) and **Kakarakaya Karam Podi** (row 17) have identical prices and map to the existing Kakarakaya product once.
- **Pesara Avakaya:** requested in the feedback, but absent from this new master. Earlier source prices conflicted. It is not created without an approved price.
- **Minapa Vadiyalu:** absent from the master, but the owner previously confirmed ₹1,200 for 1 kg and 100 packs. Its current price and inventory are preserved.
- **Availability:** a price list is not a stock count. Existing zero-stock entries stay unavailable; no availability is fabricated.
- **Ingredients, allergens and shelf life:** no new claims are inferred from names or generated images.

## Editable prices and SEO

This is a normal, once-only Prisma migration, not a startup seed or a frontend price override. After it has been applied, later price, description and stock changes in Admin remain authoritative. Homepage, collection, detail, cart and checkout continue reading the database catalogue. Existing approved products' SEO titles use their saved name and Aavaruchi; SEO descriptions use their saved product-specific description. Public location and contact policies are unchanged.

## Validation and limits

The migration regression test uses transaction-scoped, isolated product/category/brand fixtures. It checks approved prices, distinct pack handling, archive state, preserved stock/media/tax/variant IDs, zero-stock new products, duplicate-safe inserts and subsequent admin price edits. Its MySQL execution requires `RUN_DB_TESTS=1`; a skipped local test is not evidence of a successful database run.

The feedback's launch checklist also requires merchant-confirmed stock, actual packaging accuracy and real successful/failed payment plus email checks. Code and isolated tests cannot certify a real charge, monitored support inbox or dispatch promise. No live payment or customer email should be generated merely to complete this catalogue migration.

## Vendor checklist status

| Feedback item | Revision status and evidence |
| --- | --- |
| Green Chilli test offer | Reversible archive and compare-at cleanup included in the migration; live verification required after deployment. |
| Approved range and pack prices | 52 unique master products / 85 pack prices reconciled in the source manifest. Pesara remains pending an approved price. |
| Actual stock | Existing stock preserved; all new packs deliberately start at zero. Merchant quantities remain required before availability can change. |
| About Us banner and label | Already absent in source and live page when reviewed; the main family story is retained. |
| Descriptions and SEO | Store pages share the database catalogue. Existing saved product-specific descriptions feed refreshed SEO; new entries have specific descriptions. |
| Desktop/mobile navigation and variants | Parent release checks must record results; category paths derive from the catalogue, including separate non-vegetarian subcategories. |
| Payment, duplicate handling and emails | Automated regression checks can cover these flows. No new real payment or customer-email delivery is claimed by this catalogue change. |
| Cache and live consistency | Parent release verification pending; append published version and live URLs after deployment. |

This is a correction record, not final launch sign-off. Merchant stock, approved real photography and operational checks remain separate acceptance inputs.
