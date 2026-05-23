# Bedrock Extensions

## Project: Realm-Friendly Protected Base Zones

This project targets a **Minecraft Bedrock Realm** and focuses on a **Realm-friendly claim system** that discourages griefing and provides partial protection for player bases.

It is designed as a **deterrence + mitigation system**, not a perfect plugin-level protection system.

---

## Goals

Players should be able to:
- place a **Claim Totem** to protect a base area
- mark ownership clearly
- trust friends to build/use the area
- warn untrusted visitors
- suppress dangerous grief items near claims
- alert owners/admins to suspicious activity
- optionally push repeat offenders out of the claim

---

## Non-goals

This project does **not** promise perfect prevention of:
- all block breaking
- all block placement
- all container access
- all piston/redstone grief
- all TNT/explosion edge cases
- all water/lava/fire grief in every case

---

## Recommended v1 Scope

- fixed-size claim created by placing a **Claim Totem**
- one claim per player
- no overlapping claims
- owner + trusted-player list
- enter/leave protected zone messages
- boundary visualization on demand
- dangerous-item suppression for untrusted players
- violation tracking
- optional push-out after repeated violations
- owner/admin alerts
- claim removal by owner/admin

---

## System Design

### Core claim model
Each claim stores:
- claim ID
- owner ID / name
- dimension
- totem location
- center position
- min/max X/Z bounds
- created timestamp
- active flag
- trusted player list

### Suggested claim shape
Use a **fixed square** for v1.

Example:
- center at totem
- protected footprint: `x ± 16`, `z ± 16`
- protection applies across all Y levels in the dimension

### Player data
Store per-player:
- owned claim IDs
- claim limit
- recent violation count
- admin bypass state

### Global config
- max claims per player
- claim size
- dimensions allowed
- boundary display enabled
- dangerous-item suppression enabled
- push-out enabled
- violation threshold
- owner/admin alert settings

---

## Feature Plan

### 1. Claim creation
A player places a **Claim Totem**.

System checks:
- claim limit not exceeded
- no overlap with existing claims
- claim placement allowed in this dimension/region

If valid:
- create claim
- assign owner
- store bounds/data
- confirm to player

### 2. Claim boundaries
Players can view claim edges using:
- particles
- temporary markers
- messages/actionbar feedback

### 3. Enter/leave messages
When crossing claim boundaries:
- entering protected zone message
- owner display
- trusted/untrusted status
- leaving message when exiting

### 4. Trust system
Owner can:
- add trusted players
- remove trusted players
- list trusted players

Trusted players are exempt from most restrictions inside the claim.

### 5. Dangerous-item suppression
For untrusted players inside claims, suppress or react to use of:
- lava buckets
- water buckets
- flint and steel
- fire charges
- TNT
- other high-risk items if practical

### 6. Violation tracking and deterrence
For untrusted players inside claims:
- show warnings
- track repeated violations
- optionally apply deterrents
  - slowness
  - weakness
  - mining fatigue
- optionally push out after threshold reached

### 7. Push-out system
If enabled, repeated unauthorized actions cause the player to be teleported outside the claim to a safe location.

### 8. Alerts
Notify:
- claim owner when suspicious activity happens
- admins when enabled

Example alert:
- player attempted dangerous item use in claim
- player repeatedly violated claim rules

### 9. Claim removal
Owner/admin can remove a claim.

Removal should:
- delete claim record
- clear trusted list
- deactivate the zone
- optionally return the totem

---

## Recommended Implementation Order

### Phase 1: Core claims
1. data storage
2. claim totem item/placement flow
3. claim creation validation
4. overlap checks
5. claim lookup by position
6. owner/trusted permissions model

### Phase 2: Player feedback
1. enter/leave detection
2. boundary visualization
3. status/warning messages
4. admin inspection output

### Phase 3: Protection behaviors
1. dangerous-item suppression
2. violation counter
3. deterrent effects
4. push-out behavior
5. owner/admin alerts

### Phase 4: Management tools
1. trust add/remove/list
2. claim delete
3. admin bypass
4. claim listing/inspection

### Phase 5: Optional upgrades
1. fire/fluid cleanup
2. limited snapshot/restore
3. multiple claims per player
4. named claims
5. per-claim flags

---

## Implementation Checklist

### Project setup
- [x] Decide add-on structure and Bedrock pack layout
- [x] Create behavior pack manifest
- [x] Define namespace and folder conventions
- [x] Decide storage approach for claims/player/config data
- [x] Document Realm limitations in project notes

### Core data model
- [x] Define claim record schema
- [x] Define player record schema
- [x] Define global config schema
- [x] Implement persistence helpers
- [x] Implement claim ID generation

### Claim Totem
- [x] Design Claim Totem item/block
- [x] Define how players obtain/craft it
- [x] Detect placement/use flow
- [x] Register owner on successful claim creation
- [x] Handle invalid placement messages

### Claim creation + lookup
- [x] Implement fixed-size claim bounds calculation
- [x] Implement overlap detection
- [x] Implement claim limit checks
- [x] Implement dimension/region restrictions
- [x] Implement fast lookup for "which claim is this position in?"

### Permissions
- [x] Implement owner permission checks
- [x] Implement trusted-player checks
- [x] Implement admin bypass checks
- [x] Implement untrusted-player detection in claims

### Player feedback
- [x] Enter protected zone message
- [x] Leave protected zone message
- [x] Show owner name in claim UI/message
- [x] Show untrusted warning message
- [x] Add optional actionbar/status display

### Boundary visualization
- [x] Add on-demand boundary display trigger
- [x] Render claim border with particles/markers
- [ ] Add timeout/cooldown for visualization
- [x] Ensure only nearby/relevant claims are shown

### Trust management
- [x] Add trusted player
- [x] Remove trusted player
- [x] List trusted players
- [x] Prevent duplicates and invalid entries
- [x] Show owner confirmation/error messages

### Dangerous-item suppression
- [x] Block/react to lava bucket use in claims
- [x] Block/react to water bucket use in claims
- [x] Block/react to flint and steel use in claims
- [x] Block/react to fire charge use in claims
- [x] Block/react to TNT placement/use in claims
- [x] Add configurable enable/disable settings

### Violations + deterrence
- [x] Track recent unauthorized actions
- [x] Reset violation count after cooldown
- [x] Add warning escalation
- [x] Add optional slowness/weakness/mining fatigue
- [x] Add configurable thresholds

### Push-out system
- [x] Detect when player exceeds violation threshold
- [x] Find safe teleport location outside claim
- [x] Teleport player out
- [ ] Add cooldown to avoid loops/spam
- [x] Add player-facing message

### Alerts + admin tools
- [x] Notify claim owner of suspicious activity
- [x] Notify admins of suspicious activity
- [x] Add claim inspection tool/command
- [x] Add admin bypass toggle
- [x] Add claim listing for admins

### Claim removal
- [x] Implement owner claim deletion
- [x] Implement admin claim deletion
- [x] Remove claim from persistence
- [x] Clean up trust/member references
- [x] Return or clean up Claim Totem state

### Testing
- [ ] Single-player claim creation test
- [ ] Multi-player overlap test
- [ ] Trusted player build/use test
- [ ] Untrusted player warning test
- [ ] Dangerous-item suppression test
- [ ] Push-out behavior test
- [ ] Admin alert test
- [ ] Claim removal test
- [ ] Realm deployment test

## Loading and Testing Instructions

### Local development workflow
1. Build or assemble the behavior pack in a working folder.
2. Ensure the pack has a valid `manifest.json` with a unique UUID set.
3. If using scripts, ensure module dependencies and script entry points are defined correctly.
4. Package the behavior pack as either:
   - a normal folder for local testing, or
   - a `.mcpack` / `.mcaddon` for easier import.

### Load into Minecraft Bedrock locally
1. Import the pack by:
   - double-clicking the `.mcpack` / `.mcaddon`, or
   - placing the pack folder in the local Bedrock behavior packs directory.
2. Create a new test world.
3. In world settings:
   - enable the behavior pack
   - enable any required experimental toggles if the implementation needs them
   - enable cheats if your test flow uses commands/functions
4. Enter the world and verify:
   - the pack appears in active behavior packs
   - the Claim Totem can be obtained
   - basic setup messages/functions work

### Local multiplayer testing
Use at least two players/devices/accounts if possible.

Test flow:
1. Player A creates a claim.
2. Player B enters the claim and confirms warning messages appear.
3. Player B attempts restricted actions.
4. Player A trusts Player B.
5. Player B retries the same actions.
6. Admin account verifies alerts, bypass, and claim inspection behavior.

### Load onto a Bedrock Realm
1. Test the pack in a local world first.
2. Create or use a dedicated staging copy of the Realm world.
3. Apply the behavior pack to the world that will be uploaded to the Realm.
4. Upload/replace the Realm world with the pack-enabled world.
5. Confirm the Realm has the correct active pack after upload.
6. Join the Realm with at least two players and run the multiplayer tests again.

### Recommended test scenarios
- Create a claim in an empty area
- Try creating overlapping claims
- Enter/leave claim boundaries repeatedly
- Trust and untrust another player
- Attempt lava, water, fire, and TNT use as an untrusted player
- Verify repeat violations trigger deterrents/push-out
- Remove a claim and verify cleanup
- Rejoin the world/Realm and confirm claim data persists

### Debug/testing notes
- Keep claim size small during development for faster testing
- Use a dedicated test world before touching the real Realm
- Keep a backup of the Realm world before each upload
- Log or surface clear debug messages during early implementation
- Test with experimental toggles both enabled and disabled if Realm compatibility is uncertain

### Optional v2+
- [ ] Fire cleanup in claims
- [ ] Fluid cleanup in claims
- [ ] Limited snapshot/restore
- [ ] Multiple claims per player
- [ ] Named claims
- [ ] Per-claim settings/flags

---

## Files Added

Implementation work currently exists under:
- `docs/architecture.md`
- `docs/data-schema.md`
- `docs/test-plan.md`
- `docs/deployment.md`
- `docs/mining-claims.md`
- `build-mcpack.ps1`
- `build-mcpack.cmd`
- `dist/Protected-Base-Zones-BP.mcpack`
- `dist/Mining-Claims-BP.mcpack`
- `packs/behavior_pack/README.md`
- `packs/behavior_pack/manifest.json`
- `packs/behavior_pack/scripts/config.js`
- `packs/behavior_pack/scripts/store.js`
- `packs/behavior_pack/scripts/claims.js`
- `packs/behavior_pack/scripts/main.js`
- `packs/mining_claims_behavior_pack/README.md`
- `packs/mining_claims_behavior_pack/manifest.json`
- `packs/mining_claims_behavior_pack/scripts/config.js`
- `packs/mining_claims_behavior_pack/scripts/store.js`
- `packs/mining_claims_behavior_pack/scripts/claims.js`
- `packs/mining_claims_behavior_pack/scripts/main.js`

---

## Reality Check

This project is intended to be **useful on Realms**, not perfect.

Best expected outcome:
- clear claim ownership
- reduced griefing
- blocked high-impact item abuse near bases
- better admin visibility
- repeat-offender deterrence

Not guaranteed:
- full server-plugin-grade land protection
- perfect chest/container security
- perfect prevention of every grief vector
