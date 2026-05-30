# Protected Base Zones Behavior Pack

## What is implemented
This behavior pack provides a first-pass Realm-friendly claim system using the Bedrock Script API.

### Current anchor item/block
For v1, a **Lodestone** acts as the Claim Totem anchor.

Place a Lodestone in the Overworld to attempt claim creation.

## Management commands
Use Bedrock script events:
- `/scriptevent pbz:help`
- `/scriptevent pbz:show`
- `/scriptevent pbz:trust <playerName>`
- `/scriptevent pbz:untrust <playerName>`
- `/scriptevent pbz:remove`
- `/scriptevent pbz:reset`
- `/scriptevent pbz:inspect`
- `/scriptevent pbz:list`
- `/scriptevent pbz:resetplayer <playerName>` (admin)
- `/scriptevent pbz:removeclaim <claimId>` (admin)
- `/scriptevent pbz:where <playerName>` (admin)
- `/scriptevent pbz:bypass on`
- `/scriptevent pbz:bypass off`
- `/scriptevent pbz:testmode on`
- `/scriptevent pbz:testmode off`

## Admin setup
Give yourself the admin tag to use admin-only commands:
- `/tag @s add pbz_admin`

Admin tag alone no longer bypasses protection. Bypass must be enabled explicitly with:
- `/scriptevent pbz:bypass on`

Admins can also remotely reset a player's protected zone and return them a new Lodestone with:
- `/scriptevent pbz:resetplayer <playerName>`

Or remove a specific claim from `/scriptevent pbz:list` output with:
- `/scriptevent pbz:removeclaim <claimId>`

To find a specific player's claim id and coordinates without listing everything:
- `/scriptevent pbz:where <playerName>`

## Debug messages
To see detection/cancellation debug messages in chat:
- `/tag @s add pbz_debug`

## Single-player testing mode
By default, claim protection currently affects **everyone, including the owner**.

To keep that behavior on explicitly:
- `/scriptevent pbz:testmode on`

To turn it off:
- `/scriptevent pbz:testmode off`

When test mode is on, the owner is treated like an untrusted player unless they also enable admin bypass.

`/scriptevent pbz:reset` removes your current protected zone from anywhere and gives you a new Lodestone back. This is useful if you died and cannot find your old claim.

## Current punishment/protection behavior
- Untrusted players receive **mining fatigue immediately** when they enter a protected zone.
- Mining fatigue is removed when they leave.
- Repeated violations trigger **teleportation outside the claim**.
- Other temporary punishments like slowness/weakness are no longer used.

## Performance tuning
Current defaults are tuned down to reduce FPS impact:
- action bar updates are disabled by default
- claim enter/leave polling runs at a fixed 20 ticks
- when players get close to a claim border, nearby border particles are shown every few blocks as short vertical pillars
- nearby Lodestones also show a small persistent particle marker above them

## Loading for local testing
1. Copy the folder `packs/behavior_pack` into your local Bedrock behavior packs directory, or package it as an `.mcpack`.
2. Enable the pack on a test world.
3. Enable cheats.
4. If your Bedrock version requires experimental toggles for the Script API, enable them.
5. Join the world and place a Lodestone.

## Loading on a Realm
1. Test the pack locally first.
2. Apply the behavior pack to a local copy of the world.
3. Upload that world to the Realm.
4. Join with at least two players to test trust/restriction flows.

## Important note
Script API and event cancellation behavior can vary by Bedrock version. If an event does not cancel correctly on your target version, keep the warning/alert flow but treat that action as best-effort only.
