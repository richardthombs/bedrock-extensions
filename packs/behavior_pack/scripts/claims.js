import { world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { loadClaims, loadPlayers, saveClaims, savePlayers, nextClaimId, loadConfig } from "./store.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getPlayerId(player) {
  return `${player?.id ?? player?.name ?? "unknown"}`;
}

export function getDimensionId(entityOrDimension) {
  if (!entityOrDimension) return "unknown";
  if (typeof entityOrDimension === "string") return entityOrDimension;
  return entityOrDimension.id ?? entityOrDimension.dimension?.id ?? "unknown";
}

export function normalizePlayerName(name) {
  return `${name ?? ""}`.trim().toLowerCase();
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

function overlaps(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ);
}

export function getClaims() {
  return loadClaims();
}

export function getClaimById(claimId) {
  return getClaims().find((claim) => claim.id === claimId);
}

export function getClaimsForOwner(ownerId) {
  return getClaims().filter((claim) => claim.ownerId === ownerId && claim.active !== false);
}

export function findClaimAt(dimensionId, location) {
  const block = blockLocationOf(location);
  return getClaims().find((claim) =>
    claim.active !== false &&
    claim.dimensionId === dimensionId &&
    block.x >= claim.bounds.minX &&
    block.x <= claim.bounds.maxX &&
    block.z >= claim.bounds.minZ &&
    block.z <= claim.bounds.maxZ
  );
}

export function findClaimByAnchor(dimensionId, location) {
  const block = blockLocationOf(location);
  return getClaims().find((claim) =>
    claim.active !== false &&
    claim.dimensionId === dimensionId &&
    claim.anchor.x === block.x &&
    claim.anchor.y === block.y &&
    claim.anchor.z === block.z
  );
}

export function isClaimTrustedForPlayer(claim, player) {
  if (!claim || !player) return false;

  const config = loadConfig();
  if (config.strictProtectionMode) {
    return false;
  }

  if (claim.ownerId === getPlayerId(player)) return true;
  const playerName = normalizePlayerName(player.name);
  return (claim.trusted ?? []).some((entry) => normalizePlayerName(entry) === playerName);
}

export function isBypassEnabledForPlayer(player) {
  if (!player) return false;
  const players = loadPlayers();
  const record = players[getPlayerId(player)];
  return Boolean(record?.adminBypass);
}

export function isAllowedInClaim(claim, player) {
  return isClaimTrustedForPlayer(claim, player) || isBypassEnabledForPlayer(player);
}

export function createClaim(player, center) {
  const config = loadConfig();
  const claims = getClaims();
  const players = loadPlayers();
  const playerId = getPlayerId(player);
  const dimensionId = getDimensionId(player.dimension);

  if (!config.allowedDimensions.includes(dimensionId)) {
    return { ok: false, error: `Claims are not allowed in ${dimensionId}.` };
  }

  const owned = claims.filter((claim) => claim.ownerId === playerId && claim.active !== false);
  if (owned.length >= config.maxClaimsPerPlayer) {
    return { ok: false, error: `You already own the maximum number of claims (${config.maxClaimsPerPlayer}).` };
  }

  const bounds = computeBounds(center, config.claimRadius);
  const overlapsExisting = claims.some((claim) =>
    claim.active !== false &&
    claim.dimensionId === dimensionId &&
    overlaps(bounds, claim.bounds)
  );

  if (overlapsExisting) {
    return { ok: false, error: "This area overlaps another protected zone." };
  }

  const claim = {
    id: nextClaimId(),
    ownerId: playerId,
    ownerName: player.name,
    dimensionId,
    anchor: clone(blockLocationOf(center)),
    bounds,
    createdAt: Date.now(),
    active: true,
    trusted: []
  };

  claims.push(claim);
  saveClaims(claims);

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
  const claims = getClaims();
  const players = loadPlayers();
  const target = claims.find((claim) => claim.id === claimId);
  if (!target) {
    return { ok: false, error: "Claim not found." };
  }

  const nextClaims = claims.filter((claim) => claim.id !== claimId);
  saveClaims(nextClaims);

  const ownerRecord = players[target.ownerId];
  if (ownerRecord) {
    ownerRecord.ownedClaimIds = (ownerRecord.ownedClaimIds ?? []).filter((id) => id !== claimId);
  }
  savePlayers(players);

  return { ok: true, claim: target };
}

export function addTrustedPlayer(claimId, playerName) {
  const claims = getClaims();
  const claim = claims.find((entry) => entry.id === claimId);
  if (!claim) return { ok: false, error: "Claim not found." };

  const normalized = normalizePlayerName(playerName);
  if (!normalized) return { ok: false, error: "Player name is required." };
  if ((claim.trusted ?? []).some((entry) => normalizePlayerName(entry) === normalized)) {
    return { ok: false, error: `${playerName} is already trusted.` };
  }

  claim.trusted = [...(claim.trusted ?? []), playerName.trim()];
  saveClaims(claims);
  return { ok: true, claim };
}

export function removeTrustedPlayer(claimId, playerName) {
  const claims = getClaims();
  const claim = claims.find((entry) => entry.id === claimId);
  if (!claim) return { ok: false, error: "Claim not found." };

  const normalized = normalizePlayerName(playerName);
  const before = claim.trusted ?? [];
  const after = before.filter((entry) => normalizePlayerName(entry) !== normalized);

  if (after.length === before.length) {
    return { ok: false, error: `${playerName} is not trusted on this claim.` };
  }

  claim.trusted = after;
  saveClaims(claims);
  return { ok: true, claim };
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

export function getOnlinePlayerByName(playerName) {
  const normalized = normalizePlayerName(playerName);
  return world.getAllPlayers().find((player) => normalizePlayerName(player.name) === normalized);
}

export function summarizeClaim(claim) {
  return `${claim.id}: ${claim.ownerName} @ ${claim.anchor.x}, ${claim.anchor.y}, ${claim.anchor.z} in ${claim.dimensionId} [${claim.bounds.minX}..${claim.bounds.maxX}, ${claim.bounds.minZ}..${claim.bounds.maxZ}]`;
}
