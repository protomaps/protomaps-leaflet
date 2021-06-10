import { filterFn, numberFn, getFont } from '../src/compat/json_style'

test("==",() => {
    let f = filterFn(['==','building','yes'])
    expect(f({"building":"yes"}))
})
test("!=",() => {
    let f = filterFn(['!=','building','yes'])
    expect(!f({"building":"yes"}))
    expect(f({"building":"no"}))
})
test("<",() => {
    let f = filterFn(['<','level',3])
    expect(f({"level":2}))
    expect(!f({"level":3}))
})
test(">",() => {
    let f = filterFn(['>','level',3])
    expect(f({"level":4}))
    expect(!f({"level":3}))
})
test("in",() => {
    let f = filterFn(['in','type','foo','bar'])
    expect(f({"type":"foo"}))
    expect(f({"type":"bar"}))
    expect(!f({"type":"baz"}))
})
test("!in",() => {
    let f = filterFn(['in','type','foo','bar'])
    expect(!f({"type":"bar"}))
    expect(f({"type":"baz"}))
})
test("has",() => {
    let f = filterFn(['has','type'])
    expect(f({"type":"foo"}))
    expect(!f({}))
})
test("all",() => {
    let f = filterFn(['all',["==","building","yes"],["==","type","foo"]])
    expect(!f({"building":"yes"}))
    expect!(f({"type":"foo"}))
    expect(f({"building":"yes","type":"foo"}))
})
test("any",() => {
    let f = filterFn(['any',["==","building","yes"],["==","type","foo"]])
    expect(!f({}))
    expect(f({"building":"yes"}))
    expect(f({"type":"foo"}))
    expect(f({"building":"yes","type":"foo"}))
})

test("numberFn constant", () => {
    let n = numberFn(5)
    expect(n).toEqual(5)
    n = numberFn(undefined)
    expect(n).toEqual(undefined)
})

test("numberFn function", () => {
    let n = numberFn({base:1,stops:[[14,0],[16,2]]})
    expect(n.length).toEqual(1)
    expect(n(14)).toEqual(0)
    expect(n(15)).toEqual(1)
    expect(n(16)).toEqual(2)
})

test("numberFn interpolate", () => {
   let n = numberFn(["interpolate",["exponential",1],["zoom"],14,0,16,2]) 
    expect(n.length).toEqual(1)
    expect(n(14)).toEqual(0)
    expect(n(15)).toEqual(1)
    expect(n(16)).toEqual(2)
})

test("numberFn properties", () => {
    let n = numberFn(["step",["get","scalerank"],0,1,2,3,4])
    expect(n.length).toEqual(2)
    expect(n(14,{scalerank:0})).toEqual(0)
    expect(n(14,{scalerank:1})).toEqual(2)
    expect(n(14,{scalerank:3})).toEqual(4)
    expect(n(14,{scalerank:4})).toEqual(4)
})

test("font", () => {
   let n = getFont({'text-font':['Noto'],'text-size':14}) 
   expect(n).toEqual('14px sans-serif')

   n = getFont({'text-font':['Noto'],'text-size':15}) 
   expect(n).toEqual('15px sans-serif')

   n = getFont({'text-font':['Noto'],'text-size':15},{'Noto':'serif'}) 
   expect(n).toEqual('15px serif')

   n = getFont({'text-font':['Boto','Noto'],'text-size':15},{'Noto':'serif','Boto':'Comic Sans'}) 
   expect(n).toEqual('15px Comic Sans, serif')
})

test("font size fn zoom", () => {
   let n = getFont({'text-font':['Noto'],'text-size':{'base':1,'stops':[[14,1],[16,3]]}}) 
   expect(n(14)).toEqual('1px sans-serif')
   expect(n(15)).toEqual('2px sans-serif')
   expect(n(16)).toEqual('3px sans-serif')
})

test("font size fn zoom props", () => {
   let n = getFont({'text-font':['Noto'],'text-size':["step",["get","scalerank"],0,1,12,2,10]}) 
   expect(n(14,{scalerank:0})).toEqual('0px sans-serif')
   expect(n(14,{scalerank:1})).toEqual('12px sans-serif')
   expect(n(14,{scalerank:2})).toEqual('10px sans-serif')
})