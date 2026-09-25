alter table program add column if not exists paused_at timestamptz;
comment on column program.paused_at is 'When set, the block is paused: the week counter freezes at this instant until resumed (which shifts start_date forward by the paused duration).';
