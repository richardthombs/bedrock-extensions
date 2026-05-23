# Data Schema

## Claim
```json
{
  "id": "claim-1",
  "ownerId": "player-id-or-name",
  "ownerName": "PlayerName",
  "dimensionId": "minecraft:overworld",
  "anchor": { "x": 100, "y": 64, "z": -20 },
  "bounds": {
    "minX": 84,
    "maxX": 116,
    "minZ": -36,
    "maxZ": -4
  },
  "createdAt": 1747990000000,
  "active": true,
  "trusted": ["FriendA", "FriendB"]
}
```

## Player metadata
```json
{
  "player-id-or-name": {
    "ownedClaimIds": ["claim-1"],
    "adminBypass": false,
    "lastKnownName": "PlayerName"
  }
}
```

## Config override
```json
{
  "claimRadius": 16,
  "maxClaimsPerPlayer": 1,
  "allowedDimensions": ["minecraft:overworld"],
  "pushOutEnabled": true,
  "violationThreshold": 3
}
```

## Notes
- `ownerId` prefers the Bedrock runtime player id when available.
- `ownerName` is kept for display and practical trust management.
- Trust entries are stored as player names in this v1 implementation to simplify `/scriptevent` usage.
