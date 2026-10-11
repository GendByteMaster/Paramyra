import { describe, expect, it } from "vitest";
import { calculateExpression, formatCalculatorNumber } from "./calculator";

const values={a:2,b:3,c:4,x:1,t:0.5};
describe("scientific calculator, bounded AST only",()=>{
  it("computes arithmetic, functions, constants, roots and powers",()=>{
    expect(calculateExpression("2+2",values)).toEqual({ok:true,value:4,display:"4"});
    expect(calculateExpression("sin(pi/2)+sqrt(9)",values)).toMatchObject({ok:true,display:"4"});
    expect(calculateExpression("2^3^2",values)).toMatchObject({ok:true,display:"512"});
    expect(calculateExpression("1/3",values)).toMatchObject({ok:true,display:"0.333333333333"});
    expect(calculateExpression("-2^2",values)).toMatchObject({ok:true,display:"-4"});
    expect(formatCalculatorNumber(-0)).toBe("0");
  });
  it("evaluates graph variables without executing the graph or arbitrary code",()=>{
    expect(calculateExpression("a*sin(b*x+t)+c",values)).toMatchObject({ok:true});
    const result=calculateExpression("u+theta+x+t+a+b+c",values);
    expect(result).toEqual({ok:true,value:12.5,display:"12.5"});
  });
  it("rejects code, excessive expressions, invalid syntax and out-of-domain math",()=>{
    for(const expression of ["", "window.alert(1)", "constructor(1)", "sin(x,y)", "x[0]", "1/0", "sqrt(-1)", "2^50", "x".repeat(161)]){
      const result=calculateExpression(expression,values);
      expect(result.ok).toBe(false);
    }
    expect(calculateExpression("x",{...values,x:NaN}).ok).toBe(false);
    expect(calculateExpression("t",{...values,t:Infinity}).ok).toBe(false);
  });
});

describe("Calculator Pro advanced math",()=>{
  it("uses DEG/RAD only for trig and inverse trig",()=>{
    expect(calculateExpression("sin(30)",values,{angleUnit:"deg"})).toMatchObject({ok:true,display:"0.5"});
    expect(calculateExpression("sin(pi/6)",values,{angleUnit:"rad"})).toMatchObject({ok:true,display:"0.5"});
    expect(calculateExpression("asin(0.5)",values,{angleUnit:"deg"})).toMatchObject({ok:true,display:"30"});
    expect(calculateExpression("cos(60)+2^3",values,{angleUnit:"deg"})).toMatchObject({ok:true,display:"8.5"});
  });
  it("supports safe factorial, percent and prior answer",()=>{
    expect(calculateExpression("9!",values)).toMatchObject({ok:true,display:"362880"});
    expect(calculateExpression("0!",values)).toMatchObject({ok:true,display:"1"});
    expect(calculateExpression("50%+1",values)).toMatchObject({ok:true,display:"1.5"});
    expect(calculateExpression("-3!",values)).toMatchObject({ok:true,display:"-6"});
    expect(calculateExpression("2^3!",values)).toMatchObject({ok:true,display:"64"});
    expect(calculateExpression("ans+2",values,{ans:7})).toMatchObject({ok:true,display:"9"});
    expect(calculateExpression("1e-3",values)).toMatchObject({ok:true,display:"0.001"});
    expect(calculateExpression("10!",values).ok).toBe(false);
    expect(calculateExpression("(-1)!",values).ok).toBe(false);
    expect(calculateExpression("1.5!",values).ok).toBe(false);
    expect(calculateExpression("ans",values,{ans:Infinity}).ok).toBe(false);
  });
  it("does not permit arbitrary script syntax in advanced operations",()=>{
    for(const source of ["1!;alert(1)","2%%constructor","1!.__proto__","x=>x","sin(45).constructor"]){
      expect(calculateExpression(source,values).ok).toBe(false);
    }
  });
});
