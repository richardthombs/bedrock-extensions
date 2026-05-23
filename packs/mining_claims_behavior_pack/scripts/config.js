export const CONFIG = {
  namespace: "mc",
  packName: "Mining Claims",
  claimType: "mining-claim",
  claimTotemBlockType: "minecraft:waxed_copper_bulb",
  claimRadius: 32,
  maxClaimsPerPlayer: 1,
  allowedDimensions: ["minecraft:overworld"],
  adminTag: "pbz_admin"
};

export const STORAGE_KEYS = {
  claims: "pbz:claims",
  players: "mc:players",
  config: "mc:config",
  nextClaimId: "pbz:nextClaimId"
};
