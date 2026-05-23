# Diagnostic Build

This temporary build strips the pack down to the minimum needed to answer one question:

- **Is the Bedrock Script API runtime starting at all in your world?**

## Expected behavior
After enabling the pack in a fresh world:

1. On first spawn, you should see chat messages:
   - `[PBZ] Protected Base Zones diagnostic build loaded.`
   - `[PBZ] Run /scriptevent pbz:help`
2. Running:
   - `/scriptevent pbz:help`
   should send back:
   - `[PBZ] Diagnostic: received pbz:help`
   - `[PBZ] Diagnostic build active.`
   - `[PBZ] If you can see this, the script runtime and /scriptevent bridge are working.`

## What this means
### If you see those messages
The runtime works, and the earlier problem was in the full claim implementation.

### If you do not see those messages
The issue is more fundamental:
- the script runtime is not starting
- or the manifest/API target is still not compatible with your Bedrock build
- or experiments/world settings are still wrong

## Note
The full implementation was preserved in:
- `packs/behavior_pack/scripts/main.full.js`
