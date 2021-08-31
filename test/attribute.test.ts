import { FontAttr, TextAttr } from '../src/attribute'
import { GeomType } from '../src/tilecache'
import assert from 'assert'
import baretest from 'baretest'

test = baretest("Attribute")

test('fontattr', async () => {
    let f = new FontAttr({font:"12px serif"})
    assert.equal(f.get(),"12px serif")

    f = new FontAttr({font:z => { return z == 1 ? "12px serif" : "14px serif"}})
    assert.equal(f.get(1),"12px serif")
    assert.equal(f.get(2),"14px serif")

    f = new FontAttr({fontFamily:"serif",fontWeight:500,fontStyle:"italic",fontSize:14})
    assert.equal(f.get(1),"italic 500 14px serif")

    f = new FontAttr({})
    assert.equal(f.get(1),"12px sans-serif")

    f = new FontAttr({fontWeight: z => { return z == 1 ? 400 : 600 }})
    assert.equal(f.get(1),"400 12px sans-serif")
    assert.equal(f.get(2),"600 12px sans-serif")

    f = new FontAttr({fontSize: z => { return z == 1 ? 12 : 14 }})
    assert.equal(f.get(1),"12px sans-serif")
    assert.equal(f.get(2),"14px sans-serif")

    f = new FontAttr({fontStyle: z => { return z == 1 ? "normal" : "italic" }})
    assert.equal(f.get(1),"normal 12px sans-serif")
    assert.equal(f.get(2),"italic 12px sans-serif")

    f = new FontAttr({fontFamily: z => { return z == 1 ? "sans-serif" : "serif" }})
    assert.equal(f.get(1),"12px sans-serif")
    assert.equal(f.get(2),"12px serif")
})

test ('textattr', async () => {
    let t = new TextAttr()
    assert.equal(t.get(0,{props:{name:"臺北"},geomType:GeomType.Point}),"臺北")
    t = new TextAttr({properties:["name:en"]})
    assert.equal(t.get(0,{props:{'name:en':"Taipei",'name':"臺北"},geomType:GeomType.Point}),"Taipei")
    t = new TextAttr({properties:["name:en"],textTransform:"uppercase"})
    assert.equal(t.get(0,{props:{'name:en':"Taipei"},geomType:GeomType.Point}),"TAIPEI")
    t = new TextAttr({properties:["name:en"],textTransform:"uppercase"})
    assert.equal(t.get(0,{props:{}}),undefined)
})

export default test