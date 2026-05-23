import { system, world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import {
  addTrustedPlayer,
  blockLocationOf,
  createClaim,
  findClaimAt,
  findClaimByAnchor,
  getClaims,
  getClaimsForOwner,
  getDimensionId,
  getOnlinePlayerByName,
  getPlayerId,
  isAllowedInClaim,
  removeClaim,
  removeTrustedPlayer,
  setAdminBypass,
  summarizeClaim
} from "./claims.js";
import { initializeStore, loadConfig, registerDynamicProperties, saveConfig } from "./store.js";

const runtime = {
  lastClaimByPlayer: new Map(),
  lastUntrustedByPlayer: new Map(),
  violations: new Map()
};

function playerKey(player) {
  return getPlayerId(player);
}

function send(player, message) {
  try {
    player.sendMessage(`[PBZ] ${message}`);
  } catch {}
}

function actionBar(player, message) {
  if (!CONFIG.actionBarEnabled) return;
  try {
    player.onScreenDisplay?.setActionBar(`[PBZ] ${message}`);
  } catch {}
}

function debug(player, message) {
  if (!player?.hasTag?.(CONFIG.debugTag) && !player?.hasTag?.(CONFIG.adminTag)) return;
  send(player, `[debug] ${message}`);
}

async function safeCommand(target, command) {
  try {
    return await target.runCommandAsync(command);
  } catch {
    return undefined;
  }
}

function playerHasItem(player, itemTypeId) {
  try {
    const inventory = player.getComponent?.("inventory");
    const container = inventory?.container;
    if (!container) return false;

    for (let slot = 0; slot < container.size; slot += 1) {
      const item = container.getItem(slot);
      if (item?.typeId === itemTypeId && item.amount > 0) {
        return true;
      }
    }
  } catch {}
  return false;
}

async function giveStarterClaimBlockIfNeeded(player) {
  const ownedClaims = getClaimsForOwner(getPlayerId(player));
  if (ownedClaims.length > 0) return;
  if (playerHasItem(player, CONFIG.claimTotemBlockType)) return;

  await safeCommand(player, `give @s ${CONFIG.claimTotemBlockType} 1`);
  send(player, "You were given a Lodestone because you do not yet own a protected zone.");
}

function getClaimAtPlayer(player) {
  return findClaimAt(getDimensionId(player.dimension), player.location);
}

function distanceToClaimBoundaryXZ(claim, location) {
  const pos = blockLocationOf(location);
  const { minX, maxX, minZ, maxZ } = claim.bounds;
  const insideX = pos.x >= minX && pos.x <= maxX;
  const insideZ = pos.z >= minZ && pos.z <= maxZ;

  if (insideX && insideZ) {
    return Math.min(pos.x - minX, maxX - pos.x, pos.z - minZ, maxZ - pos.z);
  }

  const dx = pos.x < minX ? minX - pos.x : pos.x > maxX ? pos.x - maxX : 0;
  const dz = pos.z < minZ ? minZ - pos.z : pos.z > maxZ ? pos.z - maxZ : 0;
  return Math.max(dx, dz);
}

function analyzeClaimState(player, includeAllowedClaims) {
  const claims = getClaims();
  const dimensionId = getDimensionId(player.dimension);
  const location = player.location;

  let currentClaim;
  let nearestClaim;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const claim of claims) {
    if (claim.active === false || claim.dimensionId !== dimensionId) continue;
    if (!includeAllowedClaims && isAllowedInClaim(claim, player)) continue;

    const distance = distanceToClaimBoundaryXZ(claim, location);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestClaim = claim;
    }

    if (!currentClaim && distance === 0) {
      currentClaim = claim;
    }
  }

  return {
    currentClaim,
    nearestClaim,
    nearestDistance
  };
}

function analyzeRelevantClaimState(player) {
  return analyzeClaimState(player, false);
}

function analyzeAnyClaimState(player) {
  return analyzeClaimState(player, true);
}

async function renderParticlePillar(dimension, x, y, z, height = CONFIG.borderParticlePillarHeight) {
  for (let offset = 0; offset < height; offset += 1) {
    await safeCommand(dimension, `particle minecraft:campfire_tall_smoke_particle ${x} ${y + offset} ${z}`);
  }
}

function findVisibleGroundY(dimension, x, z, startY) {
  const initialY = Math.floor(startY);
  const minY = -64;
  const maxUp = 8;

  for (let y = initialY; y >= minY; y -= 1) {
    const feet = dimension.getBlock({ x, y, z });
    const floor = dimension.getBlock({ x, y: y - 1, z });
    if (feet && floor && isAirLike(feet) && !isUnsafeFloor(floor)) {
      return y;
    }
  }

  for (let y = initialY + 1; y <= initialY + maxUp; y += 1) {
    const feet = dimension.getBlock({ x, y, z });
    const floor = dimension.getBlock({ x, y: y - 1, z });
    if (feet && floor && isAirLike(feet) && !isUnsafeFloor(floor)) {
      return y;
    }
  }

  return Math.max(1, initialY);
}

async function renderNearbyBorderParticles(player, claim) {
  if (!claim) return;

  const pos = blockLocationOf(player.location);
  const spacing = CONFIG.borderParticleSpacing;
  const range = CONFIG.borderParticleRange;
  const proximity = CONFIG.borderParticleProximity;
  const points = [];

  const pushLine = (fixedAxis, fixedValue, start, end) => {
    const snappedStart = Math.floor(start / spacing) * spacing;
    for (let value = snappedStart; value <= end; value += spacing) {
      if (fixedAxis === "x") {
        points.push({ x: fixedValue, z: value });
      } else {
        points.push({ x: value, z: fixedValue });
      }
    }
  };

  if (Math.abs(pos.x - claim.bounds.minX) <= proximity) {
    pushLine("x", claim.bounds.minX, Math.max(claim.bounds.minZ, pos.z - range), Math.min(claim.bounds.maxZ, pos.z + range));
  }
  if (Math.abs(pos.x - claim.bounds.maxX) <= proximity) {
    pushLine("x", claim.bounds.maxX, Math.max(claim.bounds.minZ, pos.z - range), Math.min(claim.bounds.maxZ, pos.z + range));
  }
  if (Math.abs(pos.z - claim.bounds.minZ) <= proximity) {
    pushLine("z", claim.bounds.minZ, Math.max(claim.bounds.minX, pos.x - range), Math.min(claim.bounds.maxX, pos.x + range));
  }
  if (Math.abs(pos.z - claim.bounds.maxZ) <= proximity) {
    pushLine("z", claim.bounds.maxZ, Math.max(claim.bounds.minX, pos.x - range), Math.min(claim.bounds.maxX, pos.x + range));
  }

  const unique = new Map();
  for (const point of points) {
    unique.set(`${point.x},${point.z}`, point);
  }

  for (const point of unique.values()) {
    const y = findVisibleGroundY(player.dimension, point.x, point.z, pos.y + 2);
    await renderParticlePillar(player.dimension, point.x, y, point.z);
  }
}

async function renderNearbyLodestoneMarkers(player) {
  const claims = getClaims();
  const pos = blockLocationOf(player.location);
  const dimensionId = getDimensionId(player.dimension);
  const range = CONFIG.lodestoneMarkerRange;

  for (const claim of claims) {
    if (claim.active === false || claim.dimensionId !== dimensionId) continue;
    if (Math.abs(claim.anchor.x - pos.x) > range || Math.abs(claim.anchor.z - pos.z) > range) continue;

    const y = claim.anchor.y + 1;
    await renderParticlePillar(player.dimension, claim.anchor.x, y, claim.anchor.z, 2);
  }
}

function getViolationState(player) {
  const key = playerKey(player);
  const existing = runtime.violations.get(key);
  if (existing && system.currentTick - existing.lastTick <= CONFIG.violationCooldownTicks) {
    return existing;
  }

  const reset = { count: 0, lastTick: system.currentTick };
  runtime.violations.set(key, reset);
  return reset;
}

function notifyAdmins(message) {
  if (!CONFIG.adminAlertsEnabled) return;
  for (const player of world.getAllPlayers()) {
    if (player.hasTag?.(CONFIG.adminTag)) {
      send(player, message);
    }
  }
}

function notifyOwner(claim, message) {
  if (!CONFIG.ownerAlertsEnabled) return;
  const owner = getOnlinePlayerByName(claim.ownerName);
  if (owner) {
    send(owner, message);
  }
}

function getBlockTypeId(block) {
  return block?.typeId ?? "";
}

function isAirLike(block) {
  const typeId = getBlockTypeId(block);
  return typeId === "minecraft:air" || typeId === "minecraft:cave_air" || typeId === "minecraft:void_air";
}

function isHazardous(block) {
  const typeId = getBlockTypeId(block);
  return [
    "minecraft:lava",
    "minecraft:flowing_lava",
    "minecraft:fire",
    "minecraft:soul_fire",
    "minecraft:cactus",
    "minecraft:magma",
    "minecraft:magma_block",
    "minecraft:sweet_berry_bush",
    "minecraft:wither_rose",
    "minecraft:campfire",
    "minecraft:soul_campfire"
  ].includes(typeId);
}

function isUnsafeFloor(block) {
  const typeId = getBlockTypeId(block);
  return isAirLike(block) || typeId === "minecraft:water" || typeId === "minecraft:flowing_water" || typeId === "minecraft:lava" || typeId === "minecraft:flowing_lava" || isHazardous(block);
}

function isSafeTeleportLocation(dimension, x, y, z) {
  try {
    const feet = dimension.getBlock({ x, y, z });
    const head = dimension.getBlock({ x, y: y + 1, z });
    const floor = dimension.getBlock({ x, y: y - 1, z });
    return Boolean(feet && head && floor) && isAirLike(feet) && isAirLike(head) && !isUnsafeFloor(floor) && !isHazardous(feet) && !isHazardous(head);
  } catch {
    return false;
  }
}

function findSafeYInColumn(dimension, x, z, startY) {
  const minY = -64;
  const maxUp = 8;
  const initialY = Math.floor(startY);

  for (let y = initialY; y >= minY; y -= 1) {
    if (isSafeTeleportLocation(dimension, x, y, z)) {
      return y;
    }
  }

  for (let y = initialY + 1; y <= initialY + maxUp; y += 1) {
    if (isSafeTeleportLocation(dimension, x, y, z)) {
      return y;
    }
  }

  return undefined;
}

function symmetricOffsets(maxOffset) {
  const offsets = [0];
  for (let i = 1; i <= maxOffset; i += 1) {
    offsets.push(i, -i);
  }
  return offsets;
}

function findSafeTeleportTarget(player, claim) {
  const dimension = player.dimension;
  const pos = player.location;
  const baseY = Math.floor(pos.y);
  const pad = CONFIG.pushOutPadding;
  const edges = [
    { axis: "x", value: claim.bounds.minX - pad, distance: Math.abs(pos.x - claim.bounds.minX) },
    { axis: "x", value: claim.bounds.maxX + pad, distance: Math.abs(claim.bounds.maxX - pos.x) },
    { axis: "z", value: claim.bounds.minZ - pad, distance: Math.abs(pos.z - claim.bounds.minZ) },
    { axis: "z", value: claim.bounds.maxZ + pad, distance: Math.abs(claim.bounds.maxZ - pos.z) }
  ].sort((a, b) => a.distance - b.distance);

  const sideOffsets = symmetricOffsets(8);

  for (const edge of edges) {
    for (const sideOffset of sideOffsets) {
      const x = edge.axis === "x" ? edge.value : Math.floor(pos.x) + sideOffset;
      const z = edge.axis === "z" ? edge.value : Math.floor(pos.z) + sideOffset;
      const y = findSafeYInColumn(dimension, x, z, baseY);
      if (y !== undefined) {
        return { x: x + 0.5, y, z: z + 0.5 };
      }
    }
  }

  return undefined;
}

async function pushOutOfClaim(player, claim) {
  if (!CONFIG.pushOutEnabled) return;

  const target = findSafeTeleportTarget(player, claim);
  if (!target) {
    send(player, `No safe teleport location was found outside ${claim.ownerName}'s protected zone.`);
    return;
  }

  try {
    player.teleport(target, { dimension: player.dimension, keepVelocity: false });
  } catch {
    await safeCommand(player, `tp @s ${Math.floor(target.x)} ${Math.floor(target.y)} ${Math.floor(target.z)}`);
  }

  send(player, `You have been removed from ${claim.ownerName}'s protected zone.`);
}

async function setMiningFatigue(player, enabled) {
  if (enabled) {
    await safeCommand(player, "effect @s mining_fatigue 999999 255 true");
    return;
  }

  await safeCommand(player, "effect @s clear mining_fatigue");
}

async function registerViolation(player, claim, reason) {
  const state = getViolationState(player);
  state.count += 1;
  state.lastTick = system.currentTick;
  runtime.violations.set(playerKey(player), state);

  const ownerMessage = `${player.name} attempted ${reason} in your claim (${claim.id}).`;
  const adminMessage = `${player.name} attempted ${reason} in ${claim.ownerName}'s claim at ${Math.floor(player.location.x)}, ${Math.floor(player.location.y)}, ${Math.floor(player.location.z)}.`;

  send(player, `Protected zone: you are not trusted here (${reason}).`);
  notifyOwner(claim, ownerMessage);
  notifyAdmins(adminMessage);

  if (state.count >= CONFIG.violationThreshold) {
    await pushOutOfClaim(player, claim);
    state.count = 0;
    runtime.violations.set(playerKey(player), state);
  }
}

async function enterLeaveMessage(player, currentClaim, previousClaimId) {
  const key = playerKey(player);
  const wasUntrusted = runtime.lastUntrustedByPlayer.get(key) === true;
  const isUntrusted = Boolean(currentClaim) && !isAllowedInClaim(currentClaim, player);

  if (!currentClaim && previousClaimId) {
    send(player, "Leaving protected zone.");
    actionBar(player, "Outside protected zones");
  }

  if (currentClaim && currentClaim.id !== previousClaimId) {
    send(player, `Entering protected zone: ${currentClaim.ownerName} (${currentClaim.id})`);
    if (isUntrusted) {
      send(player, "You are not trusted here.");
    }
  }

  if (isUntrusted && !wasUntrusted) {
    await setMiningFatigue(player, true);
    send(player, "Mining fatigue applied while you are inside this protected zone.");
  } else if (!isUntrusted && wasUntrusted) {
    await setMiningFatigue(player, false);
    send(player, "Mining fatigue removed.");
  }

  if (isUntrusted) {
    runtime.lastUntrustedByPlayer.set(key, true);
  } else {
    runtime.lastUntrustedByPlayer.delete(key);
  }

  if (currentClaim) {
    actionBar(
      player,
      isUntrusted
        ? `Protected zone: ${currentClaim.ownerName} | untrusted`
        : `Protected zone: ${currentClaim.ownerName}`
    );
  }
}

async function showClaimBoundary(player, claim) {
  send(
    player,
    `Claim ${claim.id}: owner=${claim.ownerName}, anchor=${claim.anchor.x}, ${claim.anchor.y}, ${claim.anchor.z}, bounds=${claim.bounds.minX}..${claim.bounds.maxX} / ${claim.bounds.minZ}..${claim.bounds.maxZ}`
  );

  const y = claim.anchor.y + 1;
  const corners = [
    [claim.bounds.minX, y, claim.bounds.minZ],
    [claim.bounds.minX, y, claim.bounds.maxZ],
    [claim.bounds.maxX, y, claim.bounds.minZ],
    [claim.bounds.maxX, y, claim.bounds.maxZ]
  ];

  for (const [x, py, z] of corners) {
    await safeCommand(player.dimension, `particle minecraft:campfire_tall_smoke_particle ${x} ${py} ${z}`);
  }
}

async function handleClaimTotemPlacement(event) {
  const player = event.player;
  const block = event.block ?? event.placedBlock;
  if (!player || !block || block.typeId !== CONFIG.claimTotemBlockType) return;

  const result = createClaim(player, block.location);
  if (result.ok) {
    const claim = result.claim;
    send(player, `Claim created: ${claim.id} with radius ${CONFIG.claimRadius}.`);
    await showClaimBoundary(player, claim);
    return;
  }

  send(player, result.error);
  const pos = blockLocationOf(block.location);
  await safeCommand(player.dimension, `setblock ${pos.x} ${pos.y} ${pos.z} air replace`);
  await safeCommand(player, `give @s ${CONFIG.claimTotemBlockType} 1`);
}

function getUnauthorizedClaimForPlayer(player, location) {
  if (!player || !location) return undefined;
  const claim = findClaimAt(getDimensionId(player.dimension), location);
  if (!claim || isAllowedInClaim(claim, player)) return undefined;
  return claim;
}

async function handleProtectedAction(event, player, location, reason) {
  const claim = getUnauthorizedClaimForPlayer(player, location);
  if (!claim) return;

  debug(
    player,
    `Detected ${reason} in ${claim.id} at ${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)}. cancelProperty=${typeof event.cancel}`
  );

  if (typeof event.cancel === "boolean") {
    event.cancel = true;
    debug(player, `Attempted to cancel ${reason} in ${claim.id}.`);
  } else {
    debug(player, `Could not cancel ${reason}; event.cancel is not boolean.`);
  }

  await registerViolation(player, claim, reason);
}

function handleClaimAnchorBroken(event) {
  const player = event.player;
  const location = event.block?.location;
  const dimensionId = getDimensionId(player?.dimension ?? event.dimension);
  if (!player || !location || !dimensionId) return;

  const claim = findClaimByAnchor(dimensionId, location);
  if (!claim) return;

  const result = removeClaim(claim.id);
  if (!result.ok) return;

  send(player, `Claim ${claim.id} removed because its Lodestone anchor was broken.`);
  notifyOwner(claim, `${player.name} broke the Lodestone anchor for claim ${claim.id}. The protected zone was removed.`);
  notifyAdmins(`${player.name} broke the Lodestone anchor for ${claim.ownerName}'s claim ${claim.id}. The protected zone was removed.`);
}

function subscribeIfAvailable(signal, handler) {
  if (signal?.subscribe) {
    signal.subscribe(handler);
  }
}

function registerInitialization() {
  if (system.beforeEvents?.startup?.subscribe) {
    system.beforeEvents.startup.subscribe((event) => {
      registerDynamicProperties(event);
    });
    return;
  }

  if (world.afterEvents?.worldInitialize?.subscribe) {
    world.afterEvents.worldInitialize.subscribe((event) => {
      registerDynamicProperties(event);
    });
  }
}

registerInitialization();
initializeStore();

subscribeIfAvailable(world.afterEvents?.playerPlaceBlock, (event) => {
  void handleClaimTotemPlacement(event);
});

subscribeIfAvailable(world.afterEvents?.playerBreakBlock, (event) => {
  handleClaimAnchorBroken(event);
});

subscribeIfAvailable(world.afterEvents?.playerSpawn, (event) => {
  if (!event.initialSpawn) return;
  system.runTimeout(() => {
    send(event.player, "Protected Base Zones loaded. Use /scriptevent pbz:help and place a Lodestone to create a claim.");
    void giveStarterClaimBlockIfNeeded(event.player);
  }, 20);
});

subscribeIfAvailable(world.beforeEvents?.playerBreakBlock, (event) => {
  void handleProtectedAction(event, event.player, event.block?.location, "block breaking");
});

subscribeIfAvailable(world.beforeEvents?.playerPlaceBlock, (event) => {
  void handleProtectedAction(event, event.player, event.block?.location, "block placing");
});

subscribeIfAvailable(world.beforeEvents?.playerInteractWithBlock, (event) => {
  void handleProtectedAction(event, event.player, event.block?.location, "block interaction");
});

subscribeIfAvailable(world.beforeEvents?.itemUse, (event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || !item || !CONFIG.dangerousItemTypes.includes(item.typeId)) return;
  const claim = getClaimAtPlayer(player);
  if (!claim || isAllowedInClaim(claim, player)) return;

  debug(player, `Detected item use ${item.typeId} in ${claim.id}. cancelProperty=${typeof event.cancel}`);

  if (typeof event.cancel === "boolean") {
    event.cancel = true;
    debug(player, `Attempted to cancel item use ${item.typeId} in ${claim.id}.`);
  } else {
    debug(player, `Could not cancel item use ${item.typeId}; event.cancel is not boolean.`);
  }
  void registerViolation(player, claim, `using ${item.typeId}`);
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const key = playerKey(player);
    const currentClaim = getClaimAtPlayer(player);
    const previousClaimId = runtime.lastClaimByPlayer.get(key);
    const currentClaimId = currentClaim?.id;

    if (currentClaimId !== previousClaimId) {
      void enterLeaveMessage(player, currentClaim, previousClaimId);
      if (currentClaimId) {
        runtime.lastClaimByPlayer.set(key, currentClaimId);
      } else {
        runtime.lastClaimByPlayer.delete(key);
      }
    }

    const borderAnalysis = analyzeAnyClaimState(player);
    if (borderAnalysis.nearestClaim && Number.isFinite(borderAnalysis.nearestDistance) && borderAnalysis.nearestDistance <= CONFIG.borderParticleProximity) {
      void renderNearbyBorderParticles(player, borderAnalysis.nearestClaim);
    }

    void renderNearbyLodestoneMarkers(player);
  }
}, 20);

subscribeIfAvailable(system.afterEvents?.scriptEventReceive, (event) => {
  const source = event.sourceEntity;
  if (!source || !source.typeId || source.typeId !== "minecraft:player") return;

  const player = source;
  const message = `${event.message ?? ""}`.trim();
  const currentClaim = getClaimAtPlayer(player);

  switch (event.id) {
    case "pbz:help":
      send(player, "Commands: /scriptevent pbz:show | trust <name> | untrust <name> | remove | inspect | list | bypass on|off | testmode on|off");
      send(player, `Debug tag: /tag @s add ${CONFIG.debugTag}`);
      break;

    case "pbz:show":
      if (!currentClaim) {
        send(player, "Stand inside a claim to show its boundary.");
        return;
      }
      void showClaimBoundary(player, currentClaim);
      break;

    case "pbz:trust":
      if (!currentClaim) {
        send(player, "Stand inside your claim first.");
        return;
      }
      if (currentClaim.ownerId !== getPlayerId(player) && !player.hasTag?.(CONFIG.adminTag)) {
        send(player, "Only the owner or an admin can trust players here.");
        return;
      }
      {
        const result = addTrustedPlayer(currentClaim.id, message);
        send(player, result.ok ? `${message} added to trusted players.` : result.error);
      }
      break;

    case "pbz:untrust":
      if (!currentClaim) {
        send(player, "Stand inside your claim first.");
        return;
      }
      if (currentClaim.ownerId !== getPlayerId(player) && !player.hasTag?.(CONFIG.adminTag)) {
        send(player, "Only the owner or an admin can untrust players here.");
        return;
      }
      {
        const result = removeTrustedPlayer(currentClaim.id, message);
        send(player, result.ok ? `${message} removed from trusted players.` : result.error);
      }
      break;

    case "pbz:remove":
      if (!currentClaim) {
        send(player, "Stand inside the claim you want to remove.");
        return;
      }
      if (currentClaim.ownerId !== getPlayerId(player) && !player.hasTag?.(CONFIG.adminTag)) {
        send(player, "Only the owner or an admin can remove this claim.");
        return;
      }
      {
        const result = removeClaim(currentClaim.id);
        if (result.ok) {
          void safeCommand(player, `give @s ${CONFIG.claimTotemBlockType} 1`);
          send(player, `Claim ${currentClaim.id} removed. A new anchor was returned to you.`);
        } else {
          send(player, result.error);
        }
      }
      break;

    case "pbz:inspect":
      if (!currentClaim) {
        const analysis = analyzeRelevantClaimState(player);
        send(player, "No claim at your current position.");
        send(player, `Poll: fixed 20 ticks, nearest relevant edge distance: ${Number.isFinite(analysis.nearestDistance) ? analysis.nearestDistance : "none"}`);
        return;
      }
      {
        const analysis = analyzeRelevantClaimState(player);
        send(player, summarizeClaim(currentClaim));
        send(player, `Trusted: ${(currentClaim.trusted ?? []).join(", ") || "(none)"}`);
        send(player, `Strict test mode: ${loadConfig().strictProtectionMode ? "on" : "off"}`);
        send(player, `Poll: fixed 20 ticks, nearest relevant edge distance: ${Number.isFinite(analysis.nearestDistance) ? analysis.nearestDistance : "none"}`);
      }
      break;

    case "pbz:list":
      {
        const claims = getClaims();
        if (!claims.length) {
          send(player, "No claims found.");
          return;
        }
        for (const claim of claims) {
          send(player, summarizeClaim(claim));
        }
      }
      break;

    case "pbz:bypass":
      if (!player.hasTag?.(CONFIG.adminTag)) {
        send(player, `Add tag ${CONFIG.adminTag} to use admin bypass.`);
        return;
      }
      if (message !== "on" && message !== "off") {
        send(player, "Use /scriptevent pbz:bypass on or /scriptevent pbz:bypass off");
        return;
      }
      setAdminBypass(player, message === "on");
      send(player, `Admin bypass ${message}.`);
      break;

    case "pbz:testmode":
      if (!player.hasTag?.(CONFIG.adminTag)) {
        send(player, `Add tag ${CONFIG.adminTag} to change test mode.`);
        return;
      }
      if (message !== "on" && message !== "off") {
        send(player, "Use /scriptevent pbz:testmode on or /scriptevent pbz:testmode off");
        return;
      }
      {
        const config = loadConfig();
        saveConfig({ ...config, strictProtectionMode: message === "on" });
        send(player, `Strict test mode ${message}. When on, trusted players are ignored, but the owner still keeps access unless admin bypass is used.`);
      }
      break;
    default:
      break;
  }
});
