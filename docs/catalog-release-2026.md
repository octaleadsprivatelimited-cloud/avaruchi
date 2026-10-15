# Catalog update, 15 October 2026

The merchant supplied a price workbook and FSSAI registration certificate. The website catalog is maintained in MySQL through the authenticated admin product importer, not seeded on application startup.

- Thirty unambiguous products have 56 priced pack options: 13 veg pickles and 13 powders in 500 g and 1 kg packs, plus four fryums in 1 kg packs. Do not infer prices for 250 g packs or 500 g fryums.
- Mango Avakaya is ₹475 for 500 g and ₹950 for 1 kg, explicitly reconfirmed by the merchant. Selling price and MRP match, with no invented discount. The displayed amounts follow the list exactly. No additional GST is configured because the supplied materials contain no GSTIN or tax rate. Confirm the business's tax setup before enabling live checkout.
- Pesara Avakaya appears twice with conflicting prices (₹1,000/₹500 and ₹900/₹450). Keep it unpublished until the merchant clarifies whether these are separate products or which price applies.
- No stock quantities were supplied. New products begin with zero stock; existing stock is retained. Do not infer availability from the price list.
- The certificate identifies LAKSHMI'S TAPASI TREATS, registration 23625031002378, valid through 7 May 2027. The business address begins 3-12-52/C, Shop No. 2, rather than the previously incomplete door number. Publish the registration number and public business address, not the certificate scan or personal photograph. This is a registration, not a claim of product certification.

## Categories and product maintenance

Admin category paths use `>`: `Veg pickles > Avakaya`, `Veg pickles > Traditional pickles`, `Powders > Karam podis`, `Powders > Cooking powders`, and `Fryums > Vadiyalu`. Navigation and shop filters derive their categories and counts from published products. Desktop opens the Products menu on pointer hover. Mobile exposes expandable subcategories. Parent filters include their descendants.

CSV import can optionally update matching URL handles. It retains matched variant IDs, SKUs and stock, and lets the backend retire missing sizes while retaining order history. The merchant must select this option after reviewing the import. Unlisted legacy products can be archived reversibly through their product editor.

## Generated images

The 31 branded images in `public/images/catalog-2026/` are photorealistic AI-generated illustrations of proposed packaging. They are not actual product photographs. Product pages disclose this distinction, image alt text identifies it, and `Image type = AI-generated product illustration` is saved in catalog specifications. The extra Pesara image remains unused pending price clarification.

The prompt set is in `docs/catalog-image-prompts.json`. Generated originals are retained locally under `.artifacts/catalog-update/originals/`; optimized 1000-pixel WebP assets retain the IPTC `trainedAlgorithmicMedia` source classification. The product upload pipeline preserves this classification while stripping unrelated private metadata. Merchant Center submission remains blocked for mockup imagery until the business supplies photos of its actual products and packaging. Shipping, inventory and payment readiness are separate prerequisites.

Public FSSAI details and product prices can be edited in Admin. A deploy does not overwrite these MySQL records.
