# Compatibility Notes

## Issue found from debug log
Your Bedrock runtime reported:
- `Could not find export 'DynamicPropertiesDefinition' in module '@minecraft/server'`

This means the previous build crashed during script startup before any gameplay logic could run.

## Fix in v0.1.3
The compatibility build now:
- removes the hard import of `DynamicPropertiesDefinition`
- treats dynamic-property registration as a no-op
- attempts direct dynamic property reads/writes when available
- falls back to in-memory storage if the world refuses dynamic property access
- aligns the manifest dependency with the promoted runtime: `@minecraft/server 1.19.0`

## Important note about persistence
If direct dynamic property writes work on your Bedrock build, claims should persist.
If they do not, the pack will still work during the current session but claims may not survive a full world restart.

If that happens, the next step will be moving persistence to a scoreboard-backed store or another Bedrock-compatible persistence layer.
