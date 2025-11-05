// HARDCODED for localhost development - env vars don't reload properly in Vite dev mode
// For production (Vercel), these will be overridden by environment variables
// Updated with Base Mainnet deployment (verified contracts)
export const SILVERBACK_V2_FACTORY = "0xd0918593070682AA60Ef6367FAd43A20acaEE94d";
export const SILVERBACK_V2_ROUTER = "0x565cBf0F3eAdD873212Db91896e9a548f6D64894";

// If using Uniswap V3-like periphery until Silverback V3 is deployed
export const V3_POSITION_MANAGER = (import.meta as any).env?.VITE_V3_NFPM || ""; // NonfungiblePositionManager
export const V3_FACTORY = (import.meta as any).env?.VITE_V3_FACTORY || "";

export function isAddress(v?: string): v is `0x${string}` {
  return !!v && /^0x[a-fA-F0-9]{40}$/.test(v);
}

/**
 * Get API base URL based on current network
 * - Base: Uses current origin (vite dev server on 8080 or deployed URL)
 * - Keeta: Uses current origin (Keeta backend integrated into Vite dev server)
 */
export function getApiBaseUrl(network: "base" | "keeta"): string {
  // Both Base and Keeta use the same origin (Vite dev server has Express middleware)
  return typeof window !== "undefined" ? window.location.origin : "";
}

/**
 * Helper to make network-aware API calls
 */
export async function fetchApi(
  endpoint: string,
  network: "base" | "keeta",
  options?: RequestInit
): Promise<Response> {
  const baseUrl = getApiBaseUrl(network);
  const url = `${baseUrl}${endpoint}`;
  return fetch(url, options);
}
