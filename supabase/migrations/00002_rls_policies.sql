-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table operators enable row level security;
alter table operator_invites enable row level security;
alter table aircraft enable row level security;
alter table trips enable row level security;
alter table trip_legs enable row level security;
alter table trip_leg_results enable row level security;
alter table trip_uploads enable row level security;

-- ============================================
-- HELPER: Check if user is super_admin
-- ============================================

create or replace function is_super_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'super_admin'
  );
$$ language sql security definer stable;

-- ============================================
-- HELPER: Get user's operator_id
-- ============================================

create or replace function user_operator_id()
returns uuid as $$
  select operator_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- ============================================
-- PROFILES
-- ============================================

create policy "Users can read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Super admins can read all profiles"
  on profiles for select
  using (is_super_admin());

create policy "Operator admins can read operator profiles"
  on profiles for select
  using (operator_id = user_operator_id());

create policy "Users can update own profile"
  on profiles for update
  using (id = auth.uid());

create policy "Super admins can update any profile"
  on profiles for update
  using (is_super_admin());

-- ============================================
-- OPERATORS
-- ============================================

create policy "Users can read own operator"
  on operators for select
  using (id = user_operator_id());

create policy "Super admins can read all operators"
  on operators for select
  using (is_super_admin());

create policy "Authenticated users can create operators"
  on operators for insert
  with check (auth.uid() is not null);

create policy "Operator admins can update own operator"
  on operators for update
  using (id = user_operator_id() and exists (
    select 1 from profiles where id = auth.uid() and role = 'operator_admin'
  ));

create policy "Super admins can update any operator"
  on operators for update
  using (is_super_admin());

-- ============================================
-- OPERATOR INVITES
-- ============================================

create policy "Admins can create invites"
  on operator_invites for insert
  with check (
    is_super_admin() or (
      operator_id = user_operator_id()
      and exists (select 1 from profiles where id = auth.uid() and role = 'operator_admin')
    )
  );

create policy "Admins can view invites"
  on operator_invites for select
  using (
    is_super_admin() or operator_id = user_operator_id()
  );

create policy "Admins can update invites"
  on operator_invites for update
  using (
    is_super_admin() or (
      operator_id = user_operator_id()
      and exists (select 1 from profiles where id = auth.uid() and role = 'operator_admin')
    )
  );

-- ============================================
-- AIRCRAFT
-- ============================================

create policy "Users can read operator aircraft"
  on aircraft for select
  using (operator_id = user_operator_id() or is_super_admin());

create policy "Operator admins can insert aircraft"
  on aircraft for insert
  with check (
    operator_id = user_operator_id()
    and exists (select 1 from profiles where id = auth.uid() and role in ('operator_admin', 'super_admin'))
    or is_super_admin()
  );

create policy "Operator admins can update aircraft"
  on aircraft for update
  using (
    (operator_id = user_operator_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'operator_admin'))
    or is_super_admin()
  );

create policy "Operator admins can delete aircraft"
  on aircraft for delete
  using (
    (operator_id = user_operator_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'operator_admin'))
    or is_super_admin()
  );

-- ============================================
-- TRIPS
-- ============================================

create policy "Users can read operator trips"
  on trips for select
  using (operator_id = user_operator_id() or is_super_admin());

create policy "Operator members can create trips"
  on trips for insert
  with check (
    operator_id = user_operator_id() or is_super_admin()
  );

create policy "Trip creator or admin can update trips"
  on trips for update
  using (
    created_by = auth.uid()
    or (operator_id = user_operator_id()
        and exists (select 1 from profiles where id = auth.uid() and role = 'operator_admin'))
    or is_super_admin()
  );

-- ============================================
-- TRIP LEGS
-- ============================================

create policy "Users can read trip legs"
  on trip_legs for select
  using (
    exists (
      select 1 from trips
      where trips.id = trip_legs.trip_id
      and (trips.operator_id = user_operator_id() or is_super_admin())
    )
  );

create policy "Users can manage trip legs"
  on trip_legs for insert
  with check (
    exists (
      select 1 from trips
      where trips.id = trip_legs.trip_id
      and (trips.created_by = auth.uid() or is_super_admin())
    )
  );

create policy "Users can update trip legs"
  on trip_legs for update
  using (
    exists (
      select 1 from trips
      where trips.id = trip_legs.trip_id
      and (trips.created_by = auth.uid()
           or trips.operator_id = user_operator_id()
           or is_super_admin())
    )
  );

-- ============================================
-- TRIP LEG RESULTS
-- ============================================

create policy "Users can read trip leg results"
  on trip_leg_results for select
  using (
    exists (
      select 1 from trip_legs
      join trips on trips.id = trip_legs.trip_id
      where trip_legs.id = trip_leg_results.trip_leg_id
      and (trips.operator_id = user_operator_id() or is_super_admin())
    )
  );

create policy "System can insert trip leg results"
  on trip_leg_results for insert
  with check (auth.uid() is not null);

-- ============================================
-- TRIP UPLOADS
-- ============================================

create policy "Users can read own uploads"
  on trip_uploads for select
  using (uploaded_by = auth.uid() or is_super_admin());

create policy "Users can upload"
  on trip_uploads for insert
  with check (auth.uid() is not null);

-- ============================================
-- STORAGE BUCKET for trip PDFs
-- ============================================

insert into storage.buckets (id, name, public)
values ('trip-uploads', 'trip-uploads', false)
on conflict do nothing;

create policy "Authenticated users can upload trip files"
  on storage.objects for insert
  with check (
    bucket_id = 'trip-uploads'
    and auth.uid() is not null
  );

create policy "Users can read own trip files"
  on storage.objects for select
  using (
    bucket_id = 'trip-uploads'
    and auth.uid() is not null
  );
