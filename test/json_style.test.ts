import { filterFn, numberFn, getFont } from '../src/compat/json_style'
import assert from 'assert'
import baretest from 'baretest'

test = baretest("Json Style")

test("==",async () => {
    let f = filterFn(['==','building','yes'])
    assert(f({"building":"yes"}))
})
test("!=",async () => {
    let f = filterFn(['!=','building','yes'])
    assert(!f({"building":"yes"}))
    assert(f({"building":"no"}))
})
test("<",async () => {
    let f = filterFn(['<','level',3])
    assert(f({"level":2}))
    assert(!f({"level":3}))
})
test(">",async () => {
    let f = filterFn(['>','level',3])
    assert(f({"level":4}))
    assert(!f({"level":3}))
})
test("in",async () => {
    let f = filterFn(['in','type','foo','bar'])
    assert(f({"type":"foo"}))
    assert(f({"type":"bar"}))
    assert(!f({"type":"baz"}))
})
test("!in",async () => {
    let f = filterFn(['!in','type','foo','bar'])
    assert(!f({"type":"bar"}))
    assert(f({"type":"baz"}))
})
test("has",async () => {
    let f = filterFn(['has','type'])
    assert(f({"type":"foo"}))
    assert(!f({}))
})
test("all",async () => {
    let f = filterFn(['all',["==","building","yes"],["==","type","foo"]])
    assert(!f({"building":"yes"}))
    assert(!f({"type":"foo"}))
    assert(f({"building":"yes","type":"foo"}))
})
test("any",async () => {
    let f = filterFn(['any',["==","building","yes"],["==","type","foo"]])
    assert(!f({}))
    assert(f({"building":"yes"}))
    assert(f({"type":"foo"}))
    assert(f({"building":"yes","type":"foo"}))
})

test("numberFn constant", async () => {
    let n = numberFn(5)
    assert.equal(n,5)
    n = numberFn(undefined)
    assert.equal(n,0)
})

test("numberFn function", async () => {
    let n = numberFn({base:1,stops:[[14,0],[16,2]]})
    assert.equal(n.length,1)
    assert.equal(n(15),0)
    assert.equal(n(16),1)
    assert.equal(n(17),2)
})

test("numberFn interpolate", async () => {
   let n = numberFn(["interpolate",["exponential",1],["zoom"],14,0,16,2]) 
    assert.equal(n.length,1)
    assert.equal(n(15),0)
    assert.equal(n(16),1)
    assert.equal(n(17),2)
})

test("numberFn properties", async () => {
    let n = numberFn(["step",["get","scalerank"],0,1,2,3,4])
    assert.equal(n.length,2)
    assert.equal(n(14,{scalerank:0}),0)
    assert.equal(n(14,{scalerank:1}),2)
    assert.equal(n(14,{scalerank:3}),4)
    assert.equal(n(14,{scalerank:4}),4)
})

test("font", async () => {
   let n = getFont({'text-font':['Noto'],'text-size':14},{})
   assert.equal(n,'14px sans-serif')

   n = getFont({'text-font':['Noto'],'text-size':15},{})
   assert.equal(n,'15px sans-serif')

   n = getFont({'text-font':['Noto'],'text-size':15},{'Noto':{face:'serif'}},{})
   assert.equal(n,'15px serif')

   n = getFont({'text-font':['Boto','Noto'],'text-size':15},{'Noto':{face:'serif'},'Boto':{face:'Comic Sans'}},{})
   assert.equal(n,'15px Comic Sans, serif')
})

test("font size fn zoom", async () => {
   let n = getFont({'text-font':['Noto'],'text-size':{'base':1,'stops':[[14,1],[16,3]]}},{})
   assert.equal(n(15),'1px sans-serif')
   assert.equal(n(16),'2px sans-serif')
   assert.equal(n(17),'3px sans-serif')
})

test("font size fn zoom props", async () => {
   let n = getFont({'text-font':['Noto'],'text-size':["step",["get","scalerank"],0,1,12,2,10]},{})
   assert.equal(n(14,{scalerank:0}),'0px sans-serif')
   assert.equal(n(14,{scalerank:1}),'12px sans-serif')
   assert.equal(n(14,{scalerank:2}),'10px sans-serif')
})

export default test