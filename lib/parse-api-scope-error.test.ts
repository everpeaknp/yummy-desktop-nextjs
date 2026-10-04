import {describe, expect, it} from "vitest";
import {parseApiScopeError} from "./parse-api-scope-error";
const forbidden=(detail:unknown)=>({response:{status:403,data:{detail}}});
describe("scope errors require evidence of a date restriction",()=>{
 it.each(["waiter","cashier","manager","custom"])("does not invent a date limit for %s permission denial",role=>{
  expect(parseApiScopeError(forbidden("Your role is not allowed to access this permission."),{role})).toMatchObject({kind:"permission_denied"});
 });
 it("preserves explicit cashier date restriction",()=>{
  expect(parseApiScopeError(forbidden("Cashiers can only view analytics for the past 24 hours"))).toMatchObject({kind:"role_cashier_limit"});
 });
 it("preserves explicit manager date restriction",()=>{
  expect(parseApiScopeError(forbidden("Managers can only view the last 30 days of data."))).toMatchObject({kind:"role_manager_limit",maxDays:30});
 });
 it("preserves subscription date restrictions",()=>{
  expect(parseApiScopeError(forbidden({code:"PLAN_DATE_SCOPE_EXCEEDED",message:"History unavailable",max_days:7}))).toMatchObject({kind:"plan_date_limit",maxDays:7});
 });
 it("preserves individual date windows",()=>{
  expect(parseApiScopeError(forbidden("This user can access analytics only from 2026-10-01 onward."))).toMatchObject({kind:"user_access_scope"});
 });
});
