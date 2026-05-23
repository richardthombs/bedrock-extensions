# Performance Notes

## Problem observed
A fresh world with the behavior pack enabled showed a large FPS drop compared with a world without the pack.

## Likely cause in earlier builds
Earlier builds repeatedly read and parsed claim/player/config data from world dynamic properties during hot paths such as:
- player position polling
- claim lookup
- permission checks
- event handlers

That meant repeated:
- `world.getDynamicProperty(...)`
- `JSON.parse(...)`
- object cloning

Even with low player counts, that can be much more expensive than expected in Bedrock's script runtime.

## Fix in v0.1.6
The pack now:
- initializes its state cache once
- keeps claims, players, config, and next-claim id in memory
- writes back only when data changes
- avoids repeated dynamic-property parsing during normal gameplay checks

## What to test
Compare FPS again using:
1. fresh world without BP
2. fresh world with BP v0.1.6
3. fresh world with BP v0.1.6 and one claim placed
4. fresh world with BP v0.1.6 and strict test mode enabled

## If FPS is still poor
Likely next reductions would be:
- disable action bar updates by default
- increase polling interval from 20 ticks to 40 ticks
- reduce owner/admin notifications during testing
- temporarily disable some event hooks to isolate the most expensive one
