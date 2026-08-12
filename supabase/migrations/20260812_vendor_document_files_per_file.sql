-- Per-file document storage for vendor accreditation (multi-file per doc_type + per-file version history)
-- Fixes: missing tables vendor_document_files / vendor_document_file_versions that code already references
-- Backfills existing vendor_documents rows so progress/list renders correctly

-- 1) vendor_document_files
create table if not exists public.vendor_document_files (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.vendor_documents(id) on delete cascade,
  file_url      text not null,
  file_name     text not null,
  notes         text,
  uploaded_by   uuid references public.profiles(id),
  created_at    timestamptz default now()
);
alter table public.vendor_document_files enable row level security;
drop policy if exists "auth_access_vendor_doc_files" on public.vendor_document_files;
create policy "auth_access_vendor_doc_files" on public.vendor_document_files
  for all to authenticated using (true) with check (true);
create index if not exists idx_vendor_document_files_document_id on public.vendor_document_files(document_id);

-- 2) vendor_document_file_versions (per-file history)
create table if not exists public.vendor_document_file_versions (
  id              uuid primary key default gen_random_uuid(),
  file_id         uuid not null references public.vendor_document_files(id) on delete cascade,
  version_number  integer not null,
  file_url        text not null,
  file_name       text not null,
  notes           text,
  uploaded_by     uuid references public.profiles(id),
  created_at      timestamptz default now(),
  unique (file_id, version_number)
);
alter table public.vendor_document_file_versions enable row level security;
drop policy if exists "auth_access_vendor_doc_file_versions" on public.vendor_document_file_versions;
create policy "auth_access_vendor_doc_file_versions" on public.vendor_document_file_versions
  for all to authenticated using (true) with check (true);
create index if not exists idx_vendor_doc_file_versions_file_id on public.vendor_document_file_versions(file_id);

-- 3) Backfill: each vendor_documents row with a current file becomes one vendor_document_files row
insert into public.vendor_document_files (document_id, file_url, file_name, notes, uploaded_by)
select id, file_url, coalesce(file_name, 'document'), notes, uploaded_by
from public.vendor_documents
where file_url is not null and file_name is not null
  and not exists (select 1 from public.vendor_document_files f where f.document_id = vendor_documents.id and f.file_url = vendor_documents.file_url)
;

-- 4) Backfill version history v1 for each backfilled file
insert into public.vendor_document_file_versions (file_id, version_number, file_url, file_name, notes, uploaded_by)
select f.id, 1, f.file_url, f.file_name, f.notes, f.uploaded_by
from public.vendor_document_files f
where not exists (select 1 from public.vendor_document_file_versions v where v.file_id = f.id and v.version_number = 1)
;

-- Ensure PostgREST picks up new tables
notify pgrst, 'reload schema';
