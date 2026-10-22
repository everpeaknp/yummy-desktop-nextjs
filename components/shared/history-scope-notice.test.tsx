import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, expect, it} from "vitest";
import {HistoryScopeNotice} from "./history-scope-notice";
afterEach(cleanup);
it("labels a permission denial without claiming a date limit",()=>{
 render(<HistoryScopeNotice error={{kind:"permission_denied",message:"You do not have access to analytics."}}/>);
 expect(screen.getByText("Access restricted")).toBeInTheDocument();
 expect(screen.queryByText("Date range restricted")).not.toBeInTheDocument();
 expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
