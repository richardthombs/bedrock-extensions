import { world } from "@minecraft/server";
import { CONFIG, STORAGE_KEYS } from "./config.js";

const cache = {
  claims: [],
  players: {},
  configOverrides: {},
  nextClaimId: 0,
  initialized: false,
  dynamicPropertiesAvailable: true
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeParse(value, fallback) {
  if (value === undefined || value === null || value === "") return clone(fallback);
  try {
    return JSON.parse(value);
  } catch {
    return clone(fallback);
  }
}

function getWorldString(key) {
  if (!cache.dynamicPropertiesAvailable) return undefined;
  try {
    return world.getDynamicProperty?.(key);
  } catch {
    cache.dynamicPropertiesAvailable = false;
    return undefined;
  }
}

function setWorldString(key, value) {
  if (!cache.dynamicPropertiesAvailable) return false;
  try {
    if (world.setDynamicProperty) {
      world.setDynamicProperty(key, value);
      return true;
    }
  } catch {
    cache.dynamicPropertiesAvailable = false;
  }
  return false;
}

function initializeCache() {
  if (cache.initialized) return;
  cache.initialized = true;

  const claimsRaw = getWorldString(STORAGE_KEYS.claims);
  cache.claims = claimsRaw !== undefined ? safeParse(claimsRaw, []) : [];

  const playersRaw = getWorldString(STORAGE_KEYS.players);
  cache.players = playersRaw !== undefined ? safeParse(playersRaw, {}) : {};

  const configRaw = getWorldString(STORAGE_KEYS.config);
  cache.configOverrides = configRaw !== undefined ? safeParse(configRaw, {}) : {};

  const nextClaimIdRaw = getWorldString(STORAGE_KEYS.nextClaimId);
  cache.nextClaimId = Number.parseInt(`${nextClaimIdRaw ?? "0"}`, 10) || 0;
}

export function registerDynamicProperties(_event) {}

export function initializeStore() {
  initializeCache();
}

export function loadClaims() {
  initializeCache();
  return cache.claims;
}

export function saveClaims(claims) {
  initializeCache();
  cache.claims = claims;
  setWorldString(STORAGE_KEYS.claims, JSON.stringify(claims));
}

export function loadPlayers() {
  initializeCache();
  return cache.players;
}

export function savePlayers(players) {
  initializeCache();
  cache.players = players;
  setWorldString(STORAGE_KEYS.players, JSON.stringify(players));
}

export function loadConfig() {
  initializeCache();
  return {
    ...CONFIG,
    ...cache.configOverrides
  };
}

export function saveConfig(overrides) {
  initializeCache();
  cache.configOverrides = clone(overrides);
  setWorldString(STORAGE_KEYS.config, JSON.stringify(overrides));
}

export function nextClaimId() {
  initializeCache();
  cache.nextClaimId += 1;
  setWorldString(STORAGE_KEYS.nextClaimId, `${cache.nextClaimId}`);
  return `claim-${cache.nextClaimId}`;
}
