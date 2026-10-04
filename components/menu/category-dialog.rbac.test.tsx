import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import {afterEach, expect, it, vi} from "vitest";
const state=vi.hoisted(()=>({permissions: [] as string[],picker:vi.fn()}));
vi.mock("@/hooks/use-auth",()=>({useAuth:(select:any)=>select({user:{role:"cashier",permissions:state.permissions}})}));
vi.mock("@/components/stations/station-picker",()=>({StationPicker:(props:any)=>{state.picker(props);return <div>Station selector {props.canManageStations && <button>Add new station</button>}</div>;}}));
import {CategoryDialog} from "./category-dialog";
afterEach(()=>{cleanup();state.picker.mockClear();});
it("allows category name edits without requesting or changing station access",async()=>{
 state.permissions=["menu.categories.manage"];
 const submit=vi.fn().mockResolvedValue(undefined);
 render(<CategoryDialog open onOpenChange={vi.fn()} onSubmit={submit} restaurantId={52} initialData={{id:1,name:"Original",station_id:4}}/>);
 expect(state.picker).not.toHaveBeenCalled();
 fireEvent.change(screen.getByPlaceholderText("e.g. Appetizers"),{target:{value:"Renamed"}});
 fireEvent.click(screen.getByRole("button",{name:"Save Changes"}));
 await waitFor(()=>expect(submit).toHaveBeenCalledWith({name:"Renamed"}));
});
it("station read access does not show station creation",()=>{
 state.permissions=["menu.categories.manage","inventory.stations.view"];
 render(<CategoryDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} restaurantId={52} initialData={{id:1,name:"Original",station_id:4}}/>);
 expect(state.picker).toHaveBeenCalled();
 expect(screen.queryByText("Add new station")).not.toBeInTheDocument();
});
it("new categories explain the station prerequisite without making denied requests",()=>{
 state.permissions=["menu.categories.manage"];
 render(<CategoryDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} restaurantId={52}/>);
 expect(state.picker).not.toHaveBeenCalled();
 expect(screen.getByRole("button",{name:"Create Category"})).toBeDisabled();
});
