import type {
  GrowthCampaign,
  GrowthCampaignStatus,
  GrowthMessageTemplate,
  GrowthOffer,
  GrowthScheduleInput,
} from "@/lib/api/growth-types";

export interface GrowthCampaignPermissions {
  manage: boolean;
  approve: boolean;
  send: boolean;
}

export interface GrowthCampaignActions {
  edit: boolean;
  submitReview: boolean;
  returnToDraft: boolean;
  approve: boolean;
  schedule: boolean;
  pause: boolean;
  cancel: boolean;
}

export const campaignStatusLabels: Record<GrowthCampaignStatus, string> = {
  draft: "Draft",
  review: "Awaiting review",
  approved: "Approved",
  scheduled: "Scheduled",
  sending: "Sending",
  completed: "Completed",
  paused: "Paused",
  canceled: "Canceled",
  failed: "Failed",
};

export function campaignActions(
  status: GrowthCampaignStatus,
  permissions: GrowthCampaignPermissions,
): GrowthCampaignActions {
  const cancelable = [
    "draft",
    "review",
    "approved",
    "scheduled",
    "sending",
    "paused",
  ].includes(status);

  return {
    edit: status === "draft" && permissions.manage,
    submitReview: status === "draft" && permissions.manage,
    returnToDraft: status === "review" && permissions.approve,
    approve: status === "review" && permissions.approve,
    schedule: status === "approved" && permissions.send,
    pause: ["scheduled", "sending"].includes(status) && permissions.send,
    cancel: cancelable && permissions.send,
  };
}

export interface CampaignApprovalCheck {
  key: "offer" | "message" | "poster" | "template";
  label: string;
  ready: boolean;
  detail: string;
}

export function campaignApprovalChecks(
  campaign: GrowthCampaign,
  templates: GrowthMessageTemplate[],
): CampaignApprovalCheck[] {
  const selectedTemplate = templates.find(
    (template) => String(template.id) === String(campaign.message_template_id),
  );
  return [
    {
      key: "offer",
      label: "Bounded offer",
      ready: Boolean(campaign.offer),
      detail: campaign.offer
        ? "Offer economics are attached to this snapshot."
        : "Attach offer economics before approval.",
    },
    {
      key: "message",
      label: "Message snapshot",
      ready: Boolean(campaign.approved_message_snapshot?.trim()),
      detail: campaign.approved_message_snapshot?.trim()
        ? "The reviewed copy is stored with the campaign."
        : "Add message copy before approval.",
    },
    {
      key: "poster",
      label: "Poster asset",
      ready: campaign.creative_asset_id != null,
      detail:
        campaign.creative_asset_id != null
          ? `Registered asset #${campaign.creative_asset_id}`
          : "Upload and register a stable poster asset before approval.",
    },
    {
      key: "template",
      label: "WhatsApp template",
      ready: Boolean(selectedTemplate && selectedTemplate.provider_status === "approved"),
      detail: selectedTemplate
        ? `${selectedTemplate.whatsapp_template_name} · ${selectedTemplate.language} · ${selectedTemplate.provider_status}`
        : "Select an available provider-approved template before approval.",
    },
  ];
}

export function isCampaignApprovalReady(checks: CampaignApprovalCheck[]): boolean {
  return checks.every((check) => check.ready);
}

export function formatOffer(offer?: GrowthOffer | null): string {
  if (!offer) return "Offer unavailable";
  const value = Number(offer.value);
  if (offer.type === "fixed") {
    return `Rs. ${Number.isFinite(value) ? value.toLocaleString("en-NP") : offer.value} off`;
  }
  const cap = Number(offer.percentage_cap);
  const base = `${Number.isFinite(value) ? value.toLocaleString("en-NP") : offer.value}% off`;
  return offer.percentage_cap != null && Number.isFinite(cap)
    ? `${base}, up to Rs. ${cap.toLocaleString("en-NP")}`
    : base;
}

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localParts(value: string): DateTimeParts {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) throw new Error("Choose a complete local date and time.");
  const [, year, month, day, hour, minute, second = "00"] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const check = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() + 1 !== parts.month ||
    check.getUTCDate() !== parts.day ||
    check.getUTCHours() !== parts.hour ||
    check.getUTCMinutes() !== parts.minute
  ) {
    throw new Error("Choose a valid local date and time.");
  }
  return parts;
}

function partsAt(instantMs: number, timeZone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(instantMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function partsAsUtc(parts: DateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function sameParts(left: DateTimeParts, right: DateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function pad(value: number): string {
  return String(Math.abs(value)).padStart(2, "0");
}

/**
 * Turns a datetime-local value into an aware ISO value in the restaurant's
 * IANA timezone. Invalid daylight-saving gaps are rejected rather than shifted.
 */
export function buildGrowthScheduleInput(
  localDateTime: string,
  timeZone: string,
): GrowthScheduleInput {
  const desired = localParts(localDateTime);
  if (!timeZone.trim()) throw new Error("Restaurant timezone is required.");

  const desiredAsUtc = partsAsUtc(desired);
  let instantMs = desiredAsUtc;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const rendered = partsAt(instantMs, timeZone);
      const correction = partsAsUtc(rendered) - desiredAsUtc;
      if (correction === 0) break;
      instantMs -= correction;
    }
  } catch {
    throw new Error("Restaurant timezone is invalid.");
  }

  const rendered = partsAt(instantMs, timeZone);
  if (!sameParts(rendered, desired)) {
    throw new Error("That local time does not exist in the restaurant timezone.");
  }

  const offsetMinutes = Math.round((partsAsUtc(rendered) - instantMs) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
  const normalizedLocal = `${String(desired.year).padStart(4, "0")}-${pad(desired.month)}-${pad(desired.day)}T${pad(desired.hour)}:${pad(desired.minute)}:${pad(desired.second)}`;

  return {
    scheduled_at: `${normalizedLocal}${offset}`,
    timezone: timeZone,
  };
}

