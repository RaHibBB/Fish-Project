-- All partners share equally (the owners agreed). Splits 10,000 basis points evenly; the leftover
-- basis point(s) go to the first partner, e.g. 3 partners → 3334 / 3333 / 3333.
UPDATE partners p
SET share_bp = CASE WHEN x.rn = 1 THEN 10000 - (x.cnt - 1) * (10000 / x.cnt) ELSE 10000 / x.cnt END
FROM (
  SELECT id,
         row_number() OVER (ORDER BY sort_order, id) AS rn,
         count(*) OVER () AS cnt
  FROM partners
  WHERE is_partner
) x
WHERE p.id = x.id;
