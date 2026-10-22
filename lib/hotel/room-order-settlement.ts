export function requiresRoomOrderKotFulfillment(input: {
  kotEnabled?: boolean | null;
  kotEntitled?: boolean | null;
}): boolean {
  return input.kotEnabled !== false && input.kotEntitled !== false;
}

export function canPostRoomOrderToFolio(input: {
  kotEnabled?: boolean | null;
  kotEntitled?: boolean | null;
  allKotsServed: boolean;
}): boolean {
  return !requiresRoomOrderKotFulfillment(input) || input.allKotsServed;
}
