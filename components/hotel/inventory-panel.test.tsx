// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  HotelAvailability,
  HotelBuilding,
  HotelFloor,
  HotelRoom,
  HotelRoomType,
} from "@/lib/hotel/types";
import { InventoryPanel } from "./inventory-panel";

const api = vi.hoisted(() => ({
  listRooms: vi.fn(),
  listRoomTypes: vi.fn(),
  listFloors: vi.fn(),
  listBuildings: vi.fn(),
  getAvailability: vi.fn(),
  updateRoom: vi.fn(),
  updateFloor: vi.fn(),
  updateBuilding: vi.fn(),
}));

vi.mock("@/lib/hotel/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/hotel/api")>();
  return { ...original, hotelPmsApi: api };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock("./booking-form-dialog", () => ({
  BookingFormDialog: ({
    open,
    initialRoom,
  }: {
    open: boolean;
    initialRoom?: HotelRoom | null;
  }) =>
    open
      ? createElement(
          "div",
          { "data-testid": "booking-form" },
          `Booking room ${initialRoom?.number}`,
        )
      : null,
}));

const building: HotelBuilding = {
  id: 1,
  restaurant_id: 9,
  name: "Main building",
  code: "MAIN",
  sort_order: 0,
  pos_x: 60,
  pos_y: 60,
  layout_width: 440,
  layout_height: 320,
  is_active: true,
  version: 1,
  floor_count: 1,
  room_count: 1,
  ready_count: 1,
  occupied_count: 0,
  attention_count: 0,
};

const floor: HotelFloor = {
  id: 10,
  restaurant_id: 9,
  building_id: building.id,
  name: "Ground floor",
  sort_order: 0,
  layout_width: 1200,
  layout_height: 700,
  is_active: true,
  building,
};

const roomType: HotelRoomType = {
  id: 30,
  restaurant_id: 9,
  code: "DLX",
  name: "Deluxe",
  description: null,
  base_occupancy: 1,
  max_adults: 2,
  max_children: 1,
  base_rate: 5000,
  amenities: [],
  is_active: true,
};

const room: HotelRoom = {
  id: 40,
  restaurant_id: 9,
  room_type_id: roomType.id,
  floor_id: floor.id,
  number: "101",
  name: null,
  capacity: 2,
  occupancy_status: "vacant",
  housekeeping_status: "clean",
  service_status: "in_service",
  notes: null,
  pos_x: 120,
  pos_y: 120,
  layout_width: 180,
  layout_height: 120,
  door_side: "bottom",
  door_offset: 0.5,
  is_active: true,
  version: 1,
  room_type: roomType,
  floor,
};

const secondRoom: HotelRoom = {
  ...room,
  id: 41,
  number: "102",
  pos_x: 220,
};

const upperFloor: HotelFloor = {
  ...floor,
  id: 11,
  name: "First floor",
  sort_order: 1,
};

const upperRoom: HotelRoom = {
  ...room,
  id: 42,
  number: "201",
  floor_id: upperFloor.id,
  floor: upperFloor,
};

const annexBuilding: HotelBuilding = {
  ...building,
  id: 2,
  name: "Garden wing",
  code: "GARDEN",
  sort_order: 1,
  room_count: 1,
};

const annexFloor: HotelFloor = {
  ...floor,
  id: 12,
  building_id: annexBuilding.id,
  name: "Garden floor",
  building: annexBuilding,
};

const annexRoom: HotelRoom = {
  ...room,
  id: 43,
  number: "301",
  floor_id: annexFloor.id,
  floor: annexFloor,
};

const availability: HotelAvailability = {
  arrival_date: "2026-08-14",
  departure_date: "2026-08-15",
  nights: 1,
  room_types: [
    {
      room_type: roomType,
      total_inventory: 1,
      available_inventory: 1,
      available_rooms: [room],
      nightly_rates: [5000],
      stay_total: 5000,
      rate_options: [],
    },
  ],
};

describe("InventoryPanel building-first room flow", () => {
  beforeEach(() => {
    api.listRooms.mockResolvedValue([room]);
    api.listRoomTypes.mockResolvedValue([roomType]);
    api.listFloors.mockResolvedValue([floor]);
    api.listBuildings.mockResolvedValue([building]);
    api.getAvailability.mockResolvedValue(availability);
    api.updateRoom.mockResolvedValue(room);
    api.updateFloor.mockResolvedValue(floor);
    api.updateBuilding.mockResolvedValue(building);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens the selected room booking directly from the buildings screen", async () => {
    render(
      createElement(InventoryPanel, {
        restaurantId: 9,
        canManage: true,
        refreshKey: 0,
        onChanged: vi.fn(),
      }),
    );

    expect(await screen.findByText("Choose a room")).toBeTruthy();
    expect(screen.queryByText("Find a room")).toBeNull();
    const overviewDoor = screen.getByLabelText("Room 101: Ready");
    expect(overviewDoor.closest("svg")).toBeNull();
    expect(overviewDoor.className).toContain("h-[140px]");
    expect(overviewDoor.textContent).toContain("NPR 5,000.00");
    expect(
      screen.getByRole("button", { name: "Show Main building" }),
    ).toBeTruthy();
    fireEvent.click(overviewDoor);

    expect((await screen.findByTestId("booking-form")).textContent).toContain(
      "Booking room 101",
    );
  });

  it("opens floor management without opening a booking", async () => {
    render(
      createElement(InventoryPanel, {
        restaurantId: 9,
        canManage: true,
        refreshKey: 0,
        onChanged: vi.fn(),
      }),
    );

    await screen.findByText("Choose a room");
    fireEvent.click(
      await screen.findByRole("button", { name: "Manage property" }),
    );
    expect(document.querySelector('[data-floor-room-plan="10"]')).toBeTruthy();
    expect(
      screen
        .getByLabelText("Room 101: Ready")
        .hasAttribute("data-hotel-room-door"),
    ).toBe(true);
    const focusedDoor = screen.getByLabelText("Room 101: Ready");
    expect(focusedDoor.closest("svg")).toBeNull();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Ground floor" }),
    );

    expect(await screen.findByText("Edit Ground floor")).toBeTruthy();
    expect(screen.queryByTestId("booking-form")).toBeNull();
    const editorDoor = screen.getByLabelText("Room 101: Ready");
    expect(editorDoor.hasAttribute("data-hotel-room-door")).toBe(true);
    expect(document.querySelector('[data-floor-room-plan="10"]')).toBeTruthy();
    expect(editorDoor.closest("svg")).toBeNull();
    expect(screen.queryByRole("button", { name: /resize room/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /resize ground floor/i }),
    ).toBeNull();
  });

  it("shows every floor and filters full-width buildings without opening another screen", async () => {
    api.listBuildings.mockResolvedValue([building, annexBuilding]);
    api.listFloors.mockResolvedValue([floor, upperFloor, annexFloor]);
    api.listRooms.mockResolvedValue([room, upperRoom, annexRoom]);
    api.getAvailability.mockResolvedValue({
      ...availability,
      room_types: [
        {
          ...availability.room_types[0],
          total_inventory: 3,
          available_inventory: 3,
          available_rooms: [room, upperRoom, annexRoom],
        },
      ],
    });

    render(
      createElement(InventoryPanel, {
        restaurantId: 9,
        canManage: true,
        refreshKey: 0,
        onChanged: vi.fn(),
      }),
    );

    expect(
      await screen.findByRole("button", { name: "Room 201: Ready" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Room 101: Ready" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Room 301: Ready" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Show Main building" }),
    );

    expect(
      screen.getByRole("button", { name: "Room 101: Ready" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Room 201: Ready" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Room 301: Ready" }),
    ).toBeNull();
  });

  it("places a room into an exact floor grid position", async () => {
    render(
      createElement(InventoryPanel, {
        restaurantId: 9,
        canManage: true,
        refreshKey: 0,
        onChanged: vi.fn(),
      }),
    );

    await screen.findByText("Choose a room");
    fireEvent.click(
      await screen.findByRole("button", { name: "Manage property" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Ground floor" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Arrange rooms" }),
    );

    const transferred = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: (type: string, value: string) => transferred.set(type, value),
      getData: (type: string) => transferred.get(type) ?? "",
    };
    const roomDoor = screen.getByLabelText("Room 101: Ready");
    fireEvent.dragStart(roomDoor, {
      dataTransfer,
    });
    const target = document.querySelector(
      '[data-room-grid-cell="3:2"]',
    ) as HTMLElement;
    expect(target).toBeTruthy();
    fireEvent.drop(target, { dataTransfer });
    fireEvent.click(
      screen.getByRole("button", { name: "Save room arrangement" }),
    );

    await waitFor(() =>
      expect(api.updateRoom).toHaveBeenCalledWith(
        40,
        expect.objectContaining({
          pos_x: 300,
          pos_y: 240,
        }),
      ),
    );
  });

  it("swaps rooms when a room is dropped onto an occupied grid position", async () => {
    api.listRooms.mockResolvedValue([room, secondRoom]);

    render(
      createElement(InventoryPanel, {
        restaurantId: 9,
        canManage: true,
        refreshKey: 0,
        onChanged: vi.fn(),
      }),
    );

    await screen.findByText("Choose a room");
    fireEvent.click(
      await screen.findByRole("button", { name: "Manage property" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Ground floor" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Arrange rooms" }),
    );

    const transferred = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: (type: string, value: string) => transferred.set(type, value),
      getData: (type: string) => transferred.get(type) ?? "",
    };
    fireEvent.dragStart(screen.getByLabelText("Room 101: Ready"), {
      dataTransfer,
    });
    const occupiedCell = document.querySelector(
      '[data-room-grid-cell="2:1"]',
    ) as HTMLElement;
    fireEvent.drop(occupiedCell, { dataTransfer });
    fireEvent.click(
      screen.getByRole("button", { name: "Save room arrangement" }),
    );

    await waitFor(() =>
      expect(api.updateRoom).toHaveBeenCalledWith(
        40,
        expect.objectContaining({ pos_x: 200, pos_y: 120 }),
      ),
    );
    expect(api.updateRoom).toHaveBeenCalledWith(
      41,
      expect.objectContaining({ pos_x: 100, pos_y: 120 }),
    );
  });

  it("exposes removal controls for buildings, rooms, and floors", async () => {
    render(
      createElement(InventoryPanel, {
        restaurantId: 9,
        canManage: true,
        refreshKey: 0,
        onChanged: vi.fn(),
      }),
    );

    await screen.findByText("Choose a room");
    fireEvent.click(
      await screen.findByRole("button", { name: "Manage property" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit building" }));
    expect(
      await screen.findByRole("button", { name: "Remove building" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByLabelText("Room 101: Ready"));
    expect(
      await screen.findByRole("button", { name: "Remove room" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Ground floor" }),
    );
    expect(
      await screen.findByRole("button", { name: "Remove floor" }),
    ).toBeTruthy();
  });
});
