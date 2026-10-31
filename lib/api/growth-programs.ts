import apiClient from "@/lib/api-client";

export type GrowthProgramInput = {
  name: string;
  scope: "every_order" | "customer";
  goal_kind: "order_spend" | "order_item_qty" | "total_item_qty" | "item_orders" | "qualifying_orders";
  goal_item_id: number | null;
  goal_quantity: number | null;
  goal_min_spend: number | null;
  reward_kind: "fixed" | "percentage" | "free_item";
  reward_value: number | null;
  reward_item_id: number | null;
  reward_quantity: number | null;
  percentage_cap: number | null;
  redemption_limit: number;
  starts_at: string;
  ends_at: string;
};

export type GrowthProgram = GrowthProgramInput & {
  id: number;
  status: "draft" | "active" | "paused" | "retired";
  goal_item_name: string | null;
  reward_item_name: string | null;
};

export const growthProgramsApi = {
  async list(): Promise<GrowthProgram[]> {
    const response = await apiClient.get("/growth/programs");
    return response.data.data;
  },
  async create(input: GrowthProgramInput): Promise<GrowthProgram> {
    const response = await apiClient.post("/growth/programs", input);
    return response.data.data;
  },
  async update(id: number, input: GrowthProgramInput): Promise<GrowthProgram> {
    const response = await apiClient.put(`/growth/programs/${id}`, input);
    return response.data.data;
  },
  async setStatus(id: number, status: "active" | "paused" | "retired"): Promise<GrowthProgram> {
    const response = await apiClient.patch(`/growth/programs/${id}/status`, { status });
    return response.data.data;
  },
};
