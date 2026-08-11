-- Optional local/dev seed data: the 10 demo Texas land parcels from the original
-- design mockups (claude_design/Database.dc.html), mapped onto the new schema.
-- Not applied automatically to the shared project — run manually against a local
-- or scratch environment if you want sample data for a smoke test.

insert into public.land_sales (parcel_id, address, city, county, state, msa, property_type, acreage, sale_date, sale_price, buyer) values
  ('LND-10432', '4820 County Road 12', 'Denton', 'Denton', 'TX', 'Dallas-Fort Worth', 'Residential', 12.40, '2026-06-12', 1240000, 'Ashford Land Holdings LLC'),
  ('LND-10487', '1102 Farm to Market Rd 428', 'Sanger', 'Denton', 'TX', 'Dallas-Fort Worth', 'Residential', 45.10, '2026-05-28', 2255000, 'Prairie Ridge Partners'),
  ('LND-10501', '900 W University Dr', 'Prosper', 'Collin', 'TX', 'Dallas-Fort Worth', 'Retail', 8.75, '2026-05-15', 1750000, 'Northgate Development Group'),
  ('LND-10556', '2210 Old Alton Rd', 'Denton', 'Denton', 'TX', 'Dallas-Fort Worth', 'Residential', 22.00, '2026-04-30', 1100000, 'Blue Line Capital'),
  ('LND-10602', '5601 E Sherman Dr', 'Little Elm', 'Denton', 'TX', 'Dallas-Fort Worth', 'Multifamily', 15.30, '2026-04-18', 1836000, 'Meridian Acquisitions'),
  ('LND-10648', '1780 County Line Rd', 'Aubrey', 'Denton', 'TX', 'Dallas-Fort Worth', 'Industrial', 60.00, '2026-03-22', 2400000, 'Westbound Ranch Co.'),
  ('LND-10689', '340 N Elm St', 'Pilot Point', 'Denton', 'TX', 'Dallas-Fort Worth', 'Office', 5.20, '2026-03-05', 676000, 'Cornerstone Realty Partners'),
  ('LND-10715', '8890 FM 455', 'Sanger', 'Denton', 'TX', 'Dallas-Fort Worth', 'Residential', 33.80, '2026-02-14', 1352000, 'Ashford Land Holdings LLC'),
  ('LND-10770', '4110 Rockhill Rd', 'Celina', 'Collin', 'TX', 'Dallas-Fort Worth', 'Retail', 18.60, '2026-01-29', 2790000, 'Northgate Development Group'),
  ('LND-10812', '260 S Loop 288', 'Denton', 'Denton', 'TX', 'Dallas-Fort Worth', 'Office', 9.40, '2026-01-09', 1410000, 'Prairie Ridge Partners');
