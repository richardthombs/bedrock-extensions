import { world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { loadClaims, loadPlayers, saveClaims, savePlayers, nextClaimId, loadConfig } from "./store.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isMiningClaimType(claim) {
  return claim?.claimType === CONFIG.claimType;
}

function overlaps(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ);
}

export function getPlayerId(player) {
  return `${player?.id ?? player?.name ?? "unknown"}`;
}

export function getDimensionId(entityOrDimension) {
  if (!entityOrDimension) return "unknown";
  if (typeof entityOrDimension === "string") return entityOrDimension;
  return entityOrDimension.id ?? entityOrDimension.dimension?.id ?? "unknown";
}

export function blockLocationOf(target) {
  if (!target) return undefined;
  const loc = target.location ?? target;
  return {
    x: Math.floor(loc.x),
    y: Math.floor(loc.y),
    z: Math.floor(loc.z)
  };
}

export function computeBounds(center, radius = CONFIG.claimRadius) {
  return {
    minX: center.x - radius,
    maxX: center.x + radius,
    minZ: center.z - radius,
    maxZ: center.z + radius
  };
}

export function getAllClaims() {
  return loadClaims();
}

export function getClaims() {
  return getAllClaims().filter((claim) => isMiningClaimType(claim) && claim.active !== false);
}

export function getClaimsForOwner(ownerId) {
  return getClaims().filter((claim) => claim.ownerId === ownerId);
}

export function findClaimByAnchor(dimensionId, location) {
  const block = blockLocationOf(location);
  return getClaims().find((claim) =>
    claim.dimensionId === dimensionId &&
    claim.anchor.x === block.x &&
    claim.anchor.y === block.y &&
    claim.anchor.z === block.z
  );
}

export function findOwnerClaimAt(player, location) {
  const ownerId = getPlayerId(player);
  const dimensionId = getDimensionId(player.dimension);
  const block = blockLocationOf(location);
  return getClaims().find((claim) =>
    claim.ownerId === ownerId &&
    claim.dimensionId === dimensionId &&
    block.x >= claim.bounds.minX &&
    block.x <= claim.bounds.maxX &&
    block.z >= claim.bounds.minZ &&
    block.z <= claim.bounds.maxZ
  );
}

export function getFirstOwnerClaim(player) {
  return getClaimsForOwner(getPlayerId(player))[0];
}

export function isBypassEnabledForPlayer(player) {
  if (!player) return false;
  const players = loadPlayers();
  const record = players[getPlayerId(player)];
  return Boolean(record?.adminBypass);
}

export function createClaim(player, center) {
  const config = loadConfig();
  const allClaims = getAllClaims();
  const players = loadPlayers();
  const playerId = getPlayerId(player);
  const dimensionId = getDimensionId(player.dimension);

  if (!config.allowedDimensions.includes(dimensionId)) {
    return { ok: false, error: `Claims are not allowed in ${dimensionId}.` };
  }

  const owned = getClaimsForOwner(playerId);
  if (owned.length >= config.maxClaimsPerPlayer) {
    return { ok: false, error: `You already own the maximum number of mining claims (${config.maxClaimsPerPlayer}).` };
  }

  const bounds = computeBounds(center, config.claimRadius);
  const overlapsExisting = allClaims.some((claim) =>
    claim.active !== false &&
    claim.dimensionId === dimensionId &&
    overlaps(bounds, claim.bounds)
  );

  if (overlapsExisting) {
    return { ok: false, error: "This mining claim would overlap another claim." };
  }

  const claim = {
    id: nextClaimId(),
    claimType: CONFIG.claimType,
    ownerId: playerId,
    ownerName: player.name,
    dimensionId,
    anchor: clone(blockLocationOf(center)),
    bounds,
    createdAt: Date.now(),
    active: true,
    trusted: []
  };

  allClaims.push(claim);
  saveClaims(allClaims);

  players[playerId] = players[playerId] ?? {
    ownedClaimIds: [],
    adminBypass: false,
    lastKnownName: player.name
  };
  players[playerId].ownedClaimIds = Array.from(new Set([...(players[playerId].ownedClaimIds ?? []), claim.id]));
  players[playerId].lastKnownName = player.name;
  savePlayers(players);

  return { ok: true, claim };
}

export function removeClaim(claimId) {
  const allClaims = getAllClaims();
  const players = loadPlayers();
  const target = allClaims.find((claim) => claim.id === claimId && isMiningClaimType(claim));
  if (!target) {
    return { ok: false, error: "Mining claim not found." };
  }

  const nextClaims = allClaims.filter((claim) => claim.id !== claimId);
  saveClaims(nextClaims);

  const ownerRecord = players[target.ownerId];
  if (ownerRecord) {
    ownerRecord.ownedClaimIds = (ownerRecord.ownedClaimIds ?? []).filter((id) => id !== claimId);
  }
  savePlayers(players);

  return { ok: true, claim: target };
}

export function setAdminBypass(player, enabled) {
  const players = loadPlayers();
  const playerId = getPlayerId(player);
  players[playerId] = players[playerId] ?? {
    ownedClaimIds: [],
    adminBypass: false,
    lastKnownName: player.name
  };
  players[playerId].adminBypass = Boolean(enabled);
  players[playerId].lastKnownName = player.name;
  savePlayers(players);
}

export function summarizeClaim(claim) {
  return `${claim.id} [${claim.claimType}]: ${claim.ownerName} @ ${claim.anchor.x}, ${claim.anchor.y}, ${claim.anchor.z} in ${claim.dimensionId} [${claim.bounds.minX}..${claim.bounds.maxX}, ${claim.bounds.minZ}..${claim.bounds.maxZ}]`;
}

export function getOnlinePlayerByName(playerName) {
  const normalized = `${playerName ?? ""}`.trim().toLowerCase();
  return world.getAllPlayers().find((player) => `${player.name ?? ""}`.trim().toLowerCase() === normalized);
}
