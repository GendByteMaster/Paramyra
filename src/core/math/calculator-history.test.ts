import {describe,expect,it} from "vitest";
import {addCalculatorHistory,parseCalculatorHistory,MAX_CALCULATOR_HISTORY,type CalculatorHistoryItem} from "./calculator-history";
const entry=(expression:string):CalculatorHistoryItem=>({expression,display:"3",value:3,unit:"rad",at:123});
describe("calculator local history",()=>{
  it("accepts valid stored calculations, bounded and newest-first",()=>{
    expect(parseCalculatorHistory(JSON.stringify([entry("1+2")]))).toEqual([entry("1+2")]);
    const items=Array.from({length:75},(_,i)=>entry(String(i+1)));
    expect(parseCalculatorHistory(JSON.stringify(items))).toHaveLength(MAX_CALCULATOR_HISTORY);
    expect(addCalculatorHistory([entry("2+1"),entry("1+2")],entry("2+1"))).toHaveLength(2);
  });
  it("fails closed for invalid, oversized and forged storage",()=>{
    expect(parseCalculatorHistory("{")).toEqual([]);
    expect(parseCalculatorHistory('"hi"')).toEqual([]);
    expect(parseCalculatorHistory(" ".repeat(24001))).toEqual([]);
    expect(parseCalculatorHistory(JSON.stringify([{...entry("x"),value:Infinity},{...entry("x"),value:2e12},{...entry("x"),at:"y"}]))).toEqual([]);
  });
});
