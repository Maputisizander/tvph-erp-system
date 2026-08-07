-- PR numbers always match their PO numbers.
-- 1. PRs share the PO sequence (one counter for both document families).
-- 2. At conversion the PO number is derived from the PR number (prefix swap),
--    so PO-2026000042 is always paired with PR-2026000042.
-- 3. Backfill the 3 pre-existing converted pairs that drifted.

-- 1. PR generator now draws from the shared po_number_seq
create or replace function public.generate_pr_number()
returns trigger
language plpgsql
as $$
begin
  if NEW.pr_number is null or NEW.pr_number = '' then
    NEW.pr_number := 'PR-' || to_char(CURRENT_DATE, 'YYYY') || lpad(nextval('public.po_number_seq')::text, 6, '0');
  end if;
  return NEW;
end;
$$;

-- pr_number_seq is no longer referenced by any trigger
drop sequence if exists public.pr_number_seq;

-- 2. PO generator: converted POs take the PR number with the prefix swapped
create or replace function public.generate_po_number()
returns trigger
language plpgsql
as $$
declare
  v_pr_number text;
begin
  if NEW.po_number is null or NEW.po_number = '' then
    if NEW.purchase_request_id is not null then
      select pr.pr_number into v_pr_number
        from public.purchase_requests pr
        where pr.id = NEW.purchase_request_id;
      if v_pr_number is not null and v_pr_number <> '' then
        NEW.po_number := 'PO-' || substr(v_pr_number, 4);
        return NEW;
      end if;
    end if;
    NEW.po_number := 'PO-' || to_char(CURRENT_DATE, 'YYYY') || lpad(nextval('public.po_number_seq')::text, 6, '0');
  end if;
  return NEW;
end;
$$;

-- 3. Backfill existing pairs: rename each converted PR to match its PO,
--    then sync the pr_number column copied onto the PO at conversion.
update public.purchase_requests pr
set pr_number = 'PR-' || substr(po.po_number, 4)
from public.purchase_orders po
where po.purchase_request_id = pr.id
  and pr.pr_number <> 'PR-' || substr(po.po_number, 4)
  and not exists (
    select 1 from public.purchase_requests other
    where other.pr_number = 'PR-' || substr(po.po_number, 4)
  );

update public.purchase_orders po
set pr_number = pr.pr_number
from public.purchase_requests pr
where pr.id = po.purchase_request_id
  and po.pr_number is distinct from pr.pr_number;
