/**
 * Fabric template system exports
 * All 4 production poster templates: Fresh, Warm, Minimal, Ticket
 */

export { TEMPLATE_COLORS } from "./types";
export type {
  FabricTemplate,
  FabricTemplateConfig,
  FabricTemplateObject,
} from "./types";

export {
  // Modern templates
  createFreshTemplate,
  createWarmTemplate,
  createMinimalTemplate,
  createTicketTemplate,
  // Legacy compatibility
  createProofOfConceptTemplate,
  // Utilities
  getTemplateColors,
  applyTemplateVariables,
  safeHex,
  getRestaurantInitials,
} from "./template-utils";
