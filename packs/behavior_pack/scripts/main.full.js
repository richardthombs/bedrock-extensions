import { system, world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import {
  addTrustedPlayer,
  blockLocationOf,
  createClaim,
  findClaimAt,
  getClaims,
  getClaimById,
  getDimensionId,
  getOnlinePlayerByName,
  getPlayerId,
  isAllowedInClaim,
  removeClaim,
  removeTrustedPlayer,
  setAdminBypass,
  summarizeClaim
} from "./claims.js";
import { registerDynamicProperties } from "./store.js";

const runtime = {
  lastClaimByPlayer: new Map(),
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

async function safeCommand(target, command) {
  try {
    return await target.runCommandAsync(command);
  } catch {
    return undefined;
  }
}

function getClaimAtPlayer(player) {
  return findClaimAt(getDimensionId(player.dimension), player.location);
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

async function pushOutOfClaim(player, claim) {
  if (!CONFIG.pushOutEnabled) return;

  const pos = player.location;
  const xDistanceToMin = Math.abs(pos.x - claim.bounds.minX);
  const xDistanceToMax = Math.abs(claim.bounds.maxX - pos.x);
  const zDistanceToMin = Math.abs(pos.z - claim.bounds.minZ);
  const zDistanceToMax = Math.abs(claim.bounds.maxZ - pos.z);

  let target = { x: pos.x, y: Math.max(1, Math.floor(pos.y) + 1), z: pos.z };
  const min = Math.min(xDistanceToMin, xDistanceToMax, zDistanceToMin, zDistanceToMax);
  const pad = CONFIG.pushOutPadding;

  if (min === xDistanceToMin) target.x = claim.bounds.minX - pad;
  else if (min === xDistanceToMax) target.x = claim.bounds.maxX + pad;
  else if (min === zDistanceToMin) target.z = claim.bounds.minZ - pad;
  else target.z = claim.bounds.maxZ + pad;

  try {
    player.teleport(target, { dimension: player.dimension, keepVelocity: false });
  } catch {
    await safeCommand(player, `tp @s ${Math.floor(target.x)} ${Math.floor(target.y)} ${Math.floor(target.z)}`);
  }

  send(player, `You have been removed from ${claim.ownerName}'s protected zone.`);
}

async function applyDeterrent(player) {
  await safeCommand(player, "effect @s slowness 2 1 true");
  await safeCommand(player, "effect @s weakness 2 0 true");
  await safeCommand(player, "effect @s mining_fatigue 2 0 true");
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

  if (state.count >= 2) {
    await applyDeterrent(player);
  }

  if (state.count >= CONFIG.violationThreshold) {
    await pushOutOfClaim(player, claim);
    state.count = 0;
    runtime.violations.set(playerKey(player), state);
  }
}

function enterLeaveMessage(player, currentClaim, previousClaimId) {
  if (!currentClaim && previousClaimId) {
    send(player, "Leaving protected zone.");
    actionBar(player, "Outside protected zones");
    return;
  }

  if (currentClaim && currentClaim.id !== previousClaimId) {
    const trusted = isAllowedInClaim(currentClaim, player);
    send(player, `Entering protected zone: ${currentClaim.ownerName} (${currentClaim.id})`);
    if (!trusted) {
      send(player, "You are not trusted here.");
    }
  }

  if (currentClaim) {
    const trusted = isAllowedInClaim(currentClaim, player);
    actionBar(
      player,
      trusted
        ? `Protected zone: ${currentClaim.ownerName}`
        : `Protected zone: ${currentClaim.ownerName} | untrusted`
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
    await safeCommand(player.dimension, `particle minecraft:basic_flame_particle ${x} ${py} ${z}`);
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
  await safeCommand(player.dimension, `setblock ${pos.x} ${pos.y} ${pos.z} air destroy`);
  await safeCommand(player, `give @s ${CONFIG.claimTotemBlockType} 1`);
}

async function handleProtectedAction(event, player, location, reason) {
  if (!player || !location) return;
  const claim = findClaimAt(getDimensionId(player.dimension), location);
  if (!claim || isAllowedInClaim(claim, player)) return;

  if (typeof event.cancel === "boolean") {
    event.cancel = true;
  }
  await registerViolation(player, claim, reason);
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

subscribeIfAvailable(world.afterEvents.playerPlaceBlock, (event) => {
  void handleClaimTotemPlacement(event);
});

subscribeIfAvailable(world.afterEvents.playerSpawn, (event) => {
  if (!event.initialSpawn) return;
  send(event.player, "Protected Base Zones loaded. Use /scriptevent pbz:help and place a Lodestone to create a claim.");
});

subscribeIfAvailable(world.beforeEvents.playerBreakBlock, (event) => {
  void handleProtectedAction(event, event.player, event.block?.location, "block breaking");
});

subscribeIfAvailable(world.beforeEvents.playerPlaceBlock, (event) => {
  void handleProtectedAction(event, event.player, event.block?.location, "block placing");
});

subscribeIfAvailable(world.beforeEvents.playerInteractWithBlock, (event) => {
  void handleProtectedAction(event, event.player, event.block?.location, "block interaction");
});

subscribeIfAvailable(world.beforeEvents.itemUse, (event) => {
  const player = event.source;
  const item = event.itemStack;
  if (!player || !item || !CONFIG.dangerousItemTypes.includes(item.typeId)) return;
  const claim = getClaimAtPlayer(player);
  if (!claim || isAllowedInClaim(claim, player)) return;
  if (typeof event.cancel === "boolean") {
    event.cancel = true;
  }
  void registerViolation(player, claim, `using ${item.typeId}`);
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const currentClaim = getClaimAtPlayer(player);
    const previousClaimId = runtime.lastClaimByPlayer.get(playerKey(player));
    const currentClaimId = currentClaim?.id;

    if (currentClaimId !== previousClaimId) {
      enterLeaveMessage(player, currentClaim, previousClaimId);
      if (currentClaimId) {
        runtime.lastClaimByPlayer.set(playerKey(player), currentClaimId);
      } else {
        runtime.lastClaimByPlayer.delete(playerKey(player));
      }
    } else if (currentClaim) {
      const trusted = isAllowedInClaim(currentClaim, player);
      actionBar(
        player,
        trusted
          ? `Protected zone: ${currentClaim.ownerName}`
          : `Protected zone: ${currentClaim.ownerName} | untrusted`
      );
    }
  }
}, CONFIG.enterLeavePollTicks);

subscribeIfAvailable(system.afterEvents.scriptEventReceive, (event) => {
  const source = event.sourceEntity;
  if (!source || !source.typeId || source.typeId !== "minecraft:player") return;

  const player = source;
  const message = `${event.message ?? ""}`.trim();
  const currentClaim = getClaimAtPlayer(player);

  switch (event.id) {
    case "pbz:help":
      send(player, "Commands: /scriptevent pbz:show | trust <name> | untrust <name> | remove | inspect | list | bypass on|off");
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
        send(player, result.ok ? `Claim ${currentClaim.id} removed.` : result.error);
      }
      break;

    case "pbz:inspect":
      if (!currentClaim) {
        send(player, "No claim at your current position.");
        return;
      }
      send(player, summarizeClaim(currentClaim));
      send(player, `Trusted: ${(currentClaim.trusted ?? []).join(", ") || "(none)"}`);
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
    default:
      break;
  }
});
