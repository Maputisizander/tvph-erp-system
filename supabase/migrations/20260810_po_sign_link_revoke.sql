-- Retire PO signature magic links after use (single-use).
-- Vendor must receive a fresh link via ERP resend for any re-upload.
alter table public.magic_links
  add column if not exists revoked_at timestamptz;

-- Public can only read active (not expired, not revoked) links.
drop policy if exists "magic_links_public_read" on public.magic_links;
create policy "magic_links_public_read" on public.magic_links
  for select to public using (expires_at > now() and revoked_at is null);

create index if not exists magic_links_revoked_at_idx
  on public.magic_links (revoked_at) where revoked_at is not null;
