export const CONFIG = {
  namespace: "pbz",
  packName: "Protected Base Zones",
  claimType: "protected-base-zone",
  claimTotemBlockType: "minecraft:lodestone",
  claimRadius: 32,
  maxClaimsPerPlayer: 1,
  allowedDimensions: ["minecraft:overworld"],
  dangerousItemTypes: [
    "minecraft:lava_bucket",
    "minecraft:water_bucket",
    "minecraft:flint_and_steel",
    "minecraft:fire_charge",
    "minecraft:tnt",
    "minecraft:end_crystal"
  ],
  violationThreshold: 3,
  violationCooldownTicks: 20 * 30,
  pushOutEnabled: true,
  pushOutPadding: 2,
  enterLeavePollTicks: 40,
  borderParticleProximity: 4,
  borderParticleSpacing: 4,
  borderParticleRange: 8,
  borderParticlePillarHeight: 3,
  lodestoneMarkerRange: 48,
  ownerAlertsEnabled: true,
  adminAlertsEnabled: true,
  adminTag: "pbz_admin",
  actionBarEnabled: false,
  strictProtectionMode: false,
  debugTag: "pbz_debug"
};

export const STORAGE_KEYS = {
  claims: "pbz:claims",
  players: "pbz:players",
  config: "pbz:config",
  nextClaimId: "pbz:nextClaimId"
};
