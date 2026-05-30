# Test Plan

## Local world smoke test
- Import the behavior pack
- Enable it on a new world
- Enable cheats
- Place a Lodestone to create a claim
- Verify claim creation message appears
- Verify a second Lodestone elsewhere fails if the same player already owns a claim

## Multiplayer tests
### Two-player trust flow
1. Player A places a Lodestone.
2. Player B enters the area and should see warning text.
3. Player A runs `/scriptevent pbz:trust PlayerB` while standing inside their own claim.
4. Player B should now be treated as trusted.
5. Player A runs `/scriptevent pbz:untrust PlayerB` and Player B should become restricted again.

### Dangerous item test
1. Player A creates a claim.
2. Player B enters while untrusted.
3. Player B attempts to use lava, water, flint and steel, TNT.
4. Verify messages, alerts, and violation escalation occur.

### Removal test
1. Owner stands inside the claim.
2. Run `/scriptevent pbz:remove`.
3. Verify the claim is deleted and the area no longer reports as protected.

### Reset recovery test
1. Owner creates a claim, then moves far away or simulates getting lost after death.
2. Run `/scriptevent pbz:reset` from anywhere.
3. Verify the claim is deleted.
4. Verify the owner receives a new Lodestone.
5. Verify the old area no longer reports as protected.

### Admin reset recovery test
1. Give Player A a claim.
2. As an admin, run `/scriptevent pbz:resetplayer PlayerA` from anywhere.
3. Verify Player A's claim is deleted.
4. Verify Player A receives a Lodestone immediately if online, or on their next spawn if offline.

### Admin remove-by-id test
1. Create at least one claim.
2. Run `/scriptevent pbz:list` and note a claim id.
3. As an admin, run `/scriptevent pbz:removeclaim <claimId>` from anywhere.
4. Verify that exact claim is deleted.
5. Verify the owner receives a Lodestone immediately if online, or on their next spawn if offline.

### Admin where lookup test
1. Give Player A a claim.
2. As an admin, run `/scriptevent pbz:where PlayerA` from anywhere.
3. Verify it prints Player A's claim id and coordinates.
4. Verify the coordinates match the Lodestone anchor and claim summary.

## Realm test flow
- Test locally first
- Upload the world with the active behavior pack to a staging Realm
- Re-run the multiplayer tests
- Confirm persistence after all players disconnect and reconnect

## Debug tips
- Give admin players the tag `pbz_admin`
- Use `/tag <name> add pbz_admin`
- Use `/scriptevent pbz:inspect` inside a claim to print claim information
- Use `/scriptevent pbz:list` to print all claim summaries to the caller
