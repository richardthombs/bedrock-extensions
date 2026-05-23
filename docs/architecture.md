# Architecture

## Scope
This implementation is a **Realm-friendly** Bedrock behavior pack using the Script API. It aims to provide useful claim-based deterrence and partial protection, not server-plugin-grade guarantees.

## v1 implementation choices
- **Behavior pack only**
- **No resource pack required**
- Uses a vanilla **Lodestone** as the initial claim totem anchor
- Uses **world dynamic properties** for persistence
- Uses **script events** for claim management commands
- Uses **best-effort event cancellation** where supported by the Bedrock Script API

## Main components
- `packs/behavior_pack/manifest.json` - pack definition
- `packs/behavior_pack/scripts/config.js` - runtime constants and settings
- `packs/behavior_pack/scripts/store.js` - dynamic property persistence
- `packs/behavior_pack/scripts/claims.js` - claim creation, lookup, trust, removal
- `packs/behavior_pack/scripts/main.js` - event subscriptions and gameplay behavior

## Claim anchor
For the initial implementation, placing a `minecraft:lodestone` acts as the **Claim Totem**.

Why:
- avoids custom item/resource-pack work for v1
- easier to import and test on a Realm
- easier to recover from failed tests

## Data persistence
Claims and player metadata are stored as JSON in world dynamic properties:
- `pbz:claims`
- `pbz:players`
- `pbz:config`
- `pbz:nextClaimId`

This is fine for a small private Realm with a modest number of claims.

## Command model
Management is currently done through `/scriptevent` commands:
- `/scriptevent pbz:help`
- `/scriptevent pbz:show`
- `/scriptevent pbz:trust <playerName>`
- `/scriptevent pbz:untrust <playerName>`
- `/scriptevent pbz:remove`
- `/scriptevent pbz:inspect`
- `/scriptevent pbz:list`
- `/scriptevent pbz:bypass on`
- `/scriptevent pbz:bypass off`

## Enforcement model
### Implemented
- claim creation on Lodestone placement
- no-overlap checks
- one-claim-per-player default
- owner/trusted/admin permission checks
- enter/leave messages
- action bar status while inside claims
- dangerous item blocking in claims where supported
- block break/place/interact protection where supported
- violation tracking with cooldown
- deterrent effects
- optional push-out
- owner/admin alerts

### Known limitations
- some Bedrock/Realm event cancellation behavior can vary by version
- chest/container denial may depend on event support in the target version
- push-out is intentionally simple and may need tuning
- border rendering is text-first with lightweight corner particles

## Recommended next steps
1. Test locally in a fresh world
2. Verify which event cancellations work on your Bedrock version
3. If stable, upload the tested world to a staging Realm
4. Later, add a custom item + resource pack if you want a true Claim Totem item
