-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tournaments table
create table tournaments (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'Chess Tournament',
  admin_id uuid references auth.users not null,
  phase text not null default 'setup' check (phase in ('setup','active')),
  max_rounds int,
  notes text default '',
  created_at timestamptz default now()
);

-- Players table
create table players (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments on delete cascade not null,
  name text not null,
  rating int,
  seed int default 0
);

-- Rounds table
create table rounds (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments on delete cascade not null,
  round_number int not null,
  is_custom boolean default false,
  created_at timestamptz default now()
);

-- Pairings table
create table pairings (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid references rounds on delete cascade not null,
  white_player_id uuid references players,
  black_player_id uuid references players,
  result text check (result in ('1-0','0-1','draw','bye') or result is null),
  is_bye boolean default false,
  board_number int default 0
);

-- Row Level Security
alter table tournaments enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;
alter table pairings enable row level security;

-- Tournaments: admin can do anything, public can read
create policy "Admin full access on tournaments"
  on tournaments for all using (auth.uid() = admin_id);
create policy "Public read tournaments"
  on tournaments for select using (true);

-- Players: admin can do anything, public can read
create policy "Admin full access on players"
  on players for all using (
    auth.uid() = (select admin_id from tournaments where id = tournament_id)
  );
create policy "Public read players"
  on players for select using (true);

-- Rounds: admin can do anything, public can read
create policy "Admin full access on rounds"
  on rounds for all using (
    auth.uid() = (select admin_id from tournaments where id = tournament_id)
  );
create policy "Public read rounds"
  on rounds for select using (true);

-- Pairings: admin can do anything, public can read
create policy "Admin full access on pairings"
  on pairings for all using (
    auth.uid() = (
      select t.admin_id from tournaments t
      join rounds r on r.tournament_id = t.id
      where r.id = round_id
    )
  );
create policy "Public read pairings"
  on pairings for select using (true);
