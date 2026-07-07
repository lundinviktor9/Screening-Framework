# underwrite/ - MLI deep-underwrite stage

The downstream underwrite stage of the screening pipeline: a **tenancy schedule** goes in,
a populated PGIM model + IRR/MOIC/Cash-on-Cash comes out, stamped back onto the deal record
in `src/data/deals.json` by `deal_id`.

Read **[INTERFACE.md](INTERFACE.md)** for the full integration contract.

## Layout

```
schemas/
  tenancy_schedule.schema.json   # one row per unit (the underwrite input)
  assumptions.schema.json        # deal-level dials (analyst's pricing view)
INTERFACE.md                     # engine <-> framework contract (Mode A / Mode B)
engine/                          # vendored engine - TO BE ADDED (next slice)
adapter.py                       # framework wrapper run_mode_a / run_mode_b - next slice
```

## Status (2026-06-09)

Schemas + interface contract authored. Engine vendoring, the adapter, server endpoints and
the React panel are the next slice. The engine itself (header-driven `inject_deal_v21.py`,
`verify.py`, the pinned `MLI v21 BASE`) is built and proven in `C:\MLI` and will be copied in.

## Principles

Self-contained module, schema-driven I/O, **human-in-the-loop mandatory** (Mode A flags signed
off before Mode B), **no false precision** (flag, do not fabricate), validate against the eval
set (West Craig / Newbury / Meadow / Cannon). West Craig is already deal `be133cc37e1816b9`.
