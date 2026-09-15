LAVA Prompt 12 — Integration Hardening

Changed files only. Do NOT overwrite your real .env with .env.example.

What changed:
1) Pixel event enrichment + deduplication:
   - Meta: content_ids/contents + eventID.
   - TikTok: content_id/content_ids + event_id.
   - Google: GA4 ecommerce item_id/item_name/price/quantity + transaction_id.
   - Snapchat: item_ids + event_id.
   - Purchase browser event keeps the same order ID as server-side CAPI event ID.
2) Server-side Purchase CAPI:
   - Meta Conversions API.
   - TikTok Events API.
   - Snapchat Conversions API.
   - COD/manual orders send after authoritative order creation.
   - Kashier/Paymob send only after backend marks payment paid.
   - Network calls are timeout-bounded and never fail the order/payment flow.
3) Catalog feeds:
   - Variant/SKU-aware rows.
   - item_group_id, color, size.
   - GTIN/barcode when present.
   - sale_price_effective_date when the store has a valid saleEndDate.
   - optional googleProductCategory field, falling back to store category.
4) Product schema adds optional catalog fields only; old documents remain valid.
5) Added integration regression tests.

ENV additions/meaning:
META_API_KEY=<Meta Conversions API access token>
META_GRAPH_API_VERSION=v26.0
TIKTOK_API_KEY=<TikTok Events API access token>
SNAPCHAT_API_KEY=<Snapchat Conversions API access token>
CONVERSION_API_TIMEOUT_MS=7000
PAYMOB_API_KEY=<Paymob API key, needed by the existing refund API flow>

Existing pixel IDs remain:
META_PIXEL_ID=<Meta Pixel/Dataset ID>
TIKTOK_PIXEL_ID=<TikTok Pixel ID>
SNAPCHAT_PIXEL_ID=<Snap Pixel ID>
GOOGLE_PIXEL_ID=<Google Analytics Measurement ID, e.g. G-...>

Important:
- Never put the server-side API tokens in the frontend .env.
- Do not change the real credentials already in your .env unless replacing a missing value.
- GOOGLE_API_KEY is not used for Google Ads server-side conversion uploads. Google Ads API requires a different OAuth/developer-token/customer setup, so this patch does not pretend GOOGLE_API_KEY is a Google Ads conversion credential.
- Google catalog feed and browser GA4 ecommerce tracking are improved in this patch.
