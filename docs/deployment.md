# Deployment Guide

## Output package
Build output:
- `dist/Protected-Base-Zones-BP.mcpack`

## Create the deployable `.mcpack`
From `C:/dev/bedrock-extensions` run either:

### Option A - Command Prompt
```bat
build-mcpack.cmd
```

### Option B - PowerShell
```powershell
./build-mcpack.ps1
```

This packages `packs/behavior_pack` into:
- `dist/Protected-Base-Zones-BP.mcpack`

## Local install
1. Double-click `Protected-Base-Zones-BP.mcpack`
2. Minecraft Bedrock should open and import the behavior pack.
3. Create a **new test world**.
4. In world settings:
   - enable the behavior pack
   - enable cheats
   - enable Script API / any required experimental toggles if your version still requires them
5. Join the world.
6. Give yourself a Lodestone and place it.

Useful commands:
- `/give @s lodestone 1`
- `/tag @s add pbz_admin`
- `/scriptevent pbz:help`

## Realm deployment
### Recommended safe process
1. **Do not deploy straight to your live Realm world first.**
2. Create a local copy of the Realm world or a fresh staging world.
3. Import and enable the pack in that local world.
4. Test locally.
5. Upload the tested world to the Realm.
6. Re-test with at least two players.

### Detailed Realm steps
1. In Minecraft Bedrock, create or prepare a local world.
2. Open that world's settings.
3. Activate the behavior pack.
4. Enter the world once and verify it loads.
5. Exit the world.
6. In the Realms menu, choose your Realm.
7. Replace/upload the Realm world using the tested local world.
8. After upload, join the Realm and verify the pack is active.

## Post-deploy checks
After joining the world or Realm:
1. Place a Lodestone in the Overworld.
2. Confirm you get a claim-created message.
3. Run `/scriptevent pbz:inspect` while standing inside the claim.
4. Add another player and test:
   - entering the claim
   - `/scriptevent pbz:trust <playerName>`
   - `/scriptevent pbz:untrust <playerName>`
   - restricted item use by an untrusted player
5. Test removal with `/scriptevent pbz:remove`.

## Current deployment assumptions
This implementation currently assumes:
- a modern Bedrock version with Script API support
- support for `@minecraft/server`
- support for dynamic properties
- support for `/scriptevent`

If import fails or the script does not start, we need the exact Bedrock version and any error messages.

## How to find the Bedrock version/API target info
Please send me the following:

### 1. Minecraft Bedrock version
You can usually find it on:
- the title screen, usually bottom-right
- Settings -> Profile (version/build often shown there)
- the launcher / app details screen

Send me the full version string, for example something like:
- `1.21.x`

### 2. Whether experiments are available/required
When editing a world, open:
- **World Settings**
- **Experiments**

Tell me:
- what experiment toggles are available
- whether there is one for scripts / beta APIs / creator features

### 3. Import/runtime errors
If the pack imports but does not work:
- send the exact import error text
- or send screenshots of the error/messages
- or tell me which step failed:
  - import failed
  - world would not load
  - pack loaded but claim creation did nothing
  - commands worked but protection did not

### 4. Optional: content log output
If you can access the content/error log on your platform, send that too.
That makes version targeting much easier.

## What I can do once you give me version info
I can then:
- adjust `min_engine_version`
- adjust the `@minecraft/server` dependency version
- remove or replace unsupported event hooks
- simplify the implementation for older Bedrock versions if needed
