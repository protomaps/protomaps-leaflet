import { NumberAttr, ColorAttr, FontAttr, TextAttr } from '../src/attribute'
import { GeomType } from '../src/tilecache'
import assert from 'assert'
import baretest from 'baretest'

test = baretest("Attribute")

test('numberattr', async () => {
    let n = new NumberAttr(undefined,undefined)
    assert.equal(n.get(),1)

    n = new NumberAttr(2,undefined)
    assert.equal(n.get(),2)

    n = new NumberAttr(undefined,3)
    assert.equal(n.get(),3)

    n = new NumberAttr(undefined,0)
    assert.equal(n.get(),0)

    n = new NumberAttr((z,f) => { return z },0)
    assert.equal(n.get(2),2)
    assert.equal(n.get(3),3)

    n = new NumberAttr(1)
    assert.equal(n.per_feature,false)
    n = new NumberAttr(z => { return z })
    assert.equal(n.per_feature,false)
    n = new NumberAttr((z,f) => { return z })
    assert.equal(n.per_feature,true)
})

test('colorattr', async () => {
    let c = new ColorAttr(undefined,undefined)
    assert.equal(c.get(),"black")

    c = new ColorAttr(undefined,"red")
    assert.equal(c.get(),"red")

    c = new ColorAttr("blue")
    assert.equal(c.get(),"blue")

    c = new ColorAttr((z,f) => { 
        if (z < 4) return "green" 
        return "aquamarine"
    })
    assert.equal(c.get(3),"green")
    assert.equal(c.get(5),"aquamarine")
    assert.equal(c.per_feature,true)

})

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
    t = new TextAttr({label_props:["name:en"]})
    assert.equal(t.get(0,{props:{'name:en':"Taipei",'name':"臺北"},geomType:GeomType.Point}),"Taipei")
    t = new TextAttr({label_props:["name:en"],textTransform:"uppercase"})
    assert.equal(t.get(0,{props:{'name:en':"Taipei"},geomType:GeomType.Point}),"TAIPEI")
    t = new TextAttr({label_props:["name:en"],textTransform:"uppercase"})
    assert.equal(t.get(0,{props:{}}),undefined)
})

export default test