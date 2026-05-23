# Mining Claims

## Overview
Mining Claims are a second behavior pack that can coexist with Protected Base Zones.

Claim anchor:
- `minecraft:waxed_copper_bulb`

Rules:
- players cannot break blocks until they place a Mining Claim anchor
- players cannot place normal blocks until they place a Mining Claim anchor
- after they own a Mining Claim, they can only break blocks inside their own Mining Claim
- after they own a Mining Claim, they can only place blocks inside their own Mining Claim
- Mining Claims and Protected Base Zones share the same overlap registry
- no claim of either type may overlap another claim of either type

## Shared overlap model
Both packs read/write the same shared claims list:
- `pbz:claims`

Each claim record now includes a `claimType`, allowing the two packs to coexist while still blocking cross-pack overlap.

## Commands
- `/scriptevent mc:help`
- `/scriptevent mc:inspect`
- `/scriptevent mc:list`
- `/scriptevent mc:remove`
- `/scriptevent mc:bypass on`
- `/scriptevent mc:bypass off`
