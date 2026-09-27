-- M10 security: asset rows are written only by media-sign `confirm`, which measures the stored object
-- in R2. Clients could otherwise under-report `bytes` and slip past the storage quota.
drop policy assets_insert on public.memory_assets;
