import { system, world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import {
  blockLocationOf,
  createClaim,
  findClaimByAnchor,
  findOwnerClaimAt,
  getClaims,
  getFirstOwnerClaim,
  getPlayerId,
  isBypassEnabledForPlayer,
  removeClaim,
  setAdminBypass,
  summarizeClaim
} from "./claims.js";
import { initializeStore, registerDynamicProperties } from "./store.js";

const runtime = {
  attemptedPlacements: new Map()
};

function send(player, message) {
  try {
    player.sendMessage(`[MC] ${message}`);
  } catch {}
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
  const ownedClaim = getFirstOwnerClaim(player);
  if (ownedClaim) return;
  if (playerHasItem(player, CONFIG.claimTotemBlockType)) return;

  await safeCommand(player, `give @s ${CONFIG.claimTotemBlockType} 1`);
  send(player, "You were given a Waxed Copper Bulb because you do not yet own a Mining Claim.");
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

async function handleClaimPlacement(event) {
  const player = event.player;
  const block = event.block ?? event.placedBlock;
  if (!player || !block || block.typeId !== CONFIG.claimTotemBlockType) return;

  const result = createClaim(player, block.location);
  if (result.ok) {
    send(player, `Mining claim created: ${result.claim.id} with radius ${CONFIG.claimRadius}.`);
    return;
  }

  send(player, result.error);
  const pos = blockLocationOf(block.location);
  await safeCommand(player.dimension, `setblock ${pos.x} ${pos.y} ${pos.z} air replace`);
  await safeCommand(player, `give @s ${CONFIG.claimTotemBlockType} 1`);
}

function handleClaimAnchorBroken(event) {
  const player = event.player;
  const location = event.block?.location;
  if (!player || !location) return;

  const claim = findClaimByAnchor(player.dimension.id, location);
  if (!claim) return;

  const result = removeClaim(claim.id);
  if (result.ok) {
    send(player, `Mining claim ${claim.id} removed because its Waxed Copper Bulb anchor was broken.`);
  }
}

function canBreakAt(player, location) {
  if (isBypassEnabledForPlayer(player)) return { ok: true };

  const ownedClaim = getFirstOwnerClaim(player);
  if (!ownedClaim) {
    return { ok: false, error: "Place a Waxed Copper Bulb to create a Mining Claim before breaking blocks." };
  }

  const currentOwnerClaim = findOwnerClaimAt(player, location);
  if (!currentOwnerClaim) {
    return { ok: false, error: "You can only break blocks inside your own Mining Claim." };
  }

  return { ok: true };
}

function canPlaceAt(player, location, blockTypeId) {
  if (isBypassEnabledForPlayer(player)) return { ok: true };

  if (blockTypeId === CONFIG.claimTotemBlockType) {
    return { ok: true };
  }

  const ownedClaim = getFirstOwnerClaim(player);
  if (!ownedClaim) {
    return { ok: false, error: "Place a Waxed Copper Bulb to create a Mining Claim before placing blocks." };
  }

  const currentOwnerClaim = findOwnerClaimAt(player, location);
  if (!currentOwnerClaim) {
    return { ok: false, error: "You can only place blocks inside your own Mining Claim." };
  }

  return { ok: true };
}


function placementKey(player, location) {
  const pos = blockLocationOf(location);
  return `${getPlayerId(player)}:${pos.x},${pos.y},${pos.z}`;
}

async function handlePlacementFallback(event) {
  const player = event.player;
  const block = event.block ?? event.placedBlock;
  if (!player || !block) return;

  const key = placementKey(player, block.location);
  const attemptedBlockTypeId = runtime.attemptedPlacements.get(key) ?? block.typeId;
  runtime.attemptedPlacements.delete(key);

  if (attemptedBlockTypeId === CONFIG.claimTotemBlockType) {
    return;
  }

  const result = canPlaceAt(player, block.location, attemptedBlockTypeId);
  if (result.ok) return;

  const pos = blockLocationOf(block.location);
  await safeCommand(player.dimension, `setblock ${pos.x} ${pos.y} ${pos.z} air replace`);
  await safeCommand(player, `give @s ${attemptedBlockTypeId} 1`);
}

subscribeIfAvailable(world.afterEvents?.playerPlaceBlock, (event) => {
  void handleClaimPlacement(event);
  void handlePlacementFallback(event);
});

subscribeIfAvailable(world.afterEvents?.playerBreakBlock, (event) => {
  handleClaimAnchorBroken(event);
});

subscribeIfAvailable(world.beforeEvents?.playerBreakBlock, (event) => {
  const player = event.player;
  const location = event.block?.location;
  if (!player || !location) return;

  const result = canBreakAt(player, location);
  if (result.ok) return;

  if (typeof event.cancel === "boolean") {
    event.cancel = true;
  }
  send(player, result.error);
});

subscribeIfAvailable(world.beforeEvents?.playerPlaceBlock, (event) => {
  const player = event.player;
  const location = event.block?.location;
  const blockTypeId = event.block?.typeId ?? event.permutationToPlace?.type?.id ?? event.permutationToPlace?.typeId;
  if (!player || !location) return;

  runtime.attemptedPlacements.set(placementKey(player, location), blockTypeId);

  const result = canPlaceAt(player, location, blockTypeId);
  if (result.ok) return;

  if (typeof event.cancel === "boolean") {
    event.cancel = true;
  }
  send(player, result.error);
});

subscribeIfAvailable(world.afterEvents?.playerSpawn, (event) => {
  if (!event.initialSpawn) return;
  system.runTimeout(() => {
    send(event.player, "Mining Claims loaded. Place a Waxed Copper Bulb to create a mining claim.");
    void giveStarterClaimBlockIfNeeded(event.player);
  }, 20);
});

subscribeIfAvailable(system.afterEvents?.scriptEventReceive, (event) => {
  const source = event.sourceEntity;
  if (!source || source.typeId !== "minecraft:player") return;

  const player = source;
  const currentClaim = findOwnerClaimAt(player, player.location) ?? getFirstOwnerClaim(player);
  const message = `${event.message ?? ""}`.trim();

  switch (event.id) {
    case "mc:help":
      send(player, "Commands: /scriptevent mc:inspect | list | remove | bypass on|off");
      break;
    case "mc:inspect":
      if (!currentClaim) {
        send(player, "You do not currently own a mining claim.");
        return;
      }
      send(player, summarizeClaim(currentClaim));
      break;
    case "mc:list":
      {
        const claims = getClaims();
        if (!claims.length) {
          send(player, "No mining claims found.");
          return;
        }
        for (const claim of claims) {
          send(player, summarizeClaim(claim));
        }
      }
      break;
    case "mc:remove":
      if (!currentClaim) {
        send(player, "You do not currently own a mining claim.");
        return;
      }
      if (currentClaim.ownerId !== getPlayerId(player) && !player.hasTag?.(CONFIG.adminTag)) {
        send(player, "Only the owner or an admin can remove this mining claim.");
        return;
      }
      {
        const result = removeClaim(currentClaim.id);
        if (result.ok) {
          void safeCommand(player, `give @s ${CONFIG.claimTotemBlockType} 1`);
          send(player, `Mining claim ${currentClaim.id} removed. A new anchor was returned to you.`);
        } else {
          send(player, result.error);
        }
      }
      break;
    case "mc:bypass":
      if (!player.hasTag?.(CONFIG.adminTag)) {
        send(player, `Add tag ${CONFIG.adminTag} to use admin bypass.`);
        return;
      }
      if (message !== "on" && message !== "off") {
        send(player, "Use /scriptevent mc:bypass on or /scriptevent mc:bypass off");
        return;
      }
      setAdminBypass(player, message === "on");
      send(player, `Mining Claims bypass ${message}.`);
      break;
    default:
      break;
  }
});

function subscribeIfAvailable(signal, handler) {
  if (signal?.subscribe) {
    signal.subscribe(handler);
  }
}

registerInitialization();
initializeStore();
