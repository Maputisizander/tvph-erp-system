-- Global organization settings: company header used by the PO PDF renderer
-- and the dashboard Settings page. Single row, id = 1.
-- ponytail: singleton row (id=1 with check) instead of a settings table + key/value rows; add rows only when settings multiply.

create table if not exists public.system_settings (
  id integer primary key default 1 check (id = 1),
  company_name text,
  company_address text,
  company_tin text,
  company_tel text,
  default_vat_rate numeric default 12,
  default_payment_terms text default 'Net 30',
  currency text default 'PHP',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- Seed with TelcoVantage defaults (matches the golden PO PDF header).
insert into public.system_settings (id, company_name, company_address, company_tin, company_tel)
values (
  1,
  'TELCOVANTAGE PHILIPPINES SERVICES INC.',
  'Unit 1811 North Tower, Park Triangle Corporate Plaza, 32nd St. cor 11th Ave, Bonifacio Global City, Taguig City 1634',
  null,
  '0920-9680070'
)
on conflict (id) do nothing;

alter table public.system_settings enable row level security;

drop policy if exists "system_settings_staff_read" on public.system_settings;
create policy "system_settings_staff_read" on public.system_settings
  for select to authenticated using (true);

drop policy if exists "system_settings_staff_write" on public.system_settings;
create policy "system_settings_staff_write" on public.system_settings
  for all to authenticated using (true) with check (true);

grant select on table public.system_settings to authenticated;
grant insert, update on table public.system_settings to authenticated;
