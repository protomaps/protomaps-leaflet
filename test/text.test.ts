import { linebreak, FontSpec, TextSpec } from '../src/text'
import assert from 'assert'
import baretest from 'baretest'

test = baretest("Text")

test('trivial',async () => {
    let lines = linebreak("foo",15)
    assert.deepEqual(lines,["foo"])
})
test('no break',async () => {
    let lines = linebreak("'s-Hertogenbosch",15)
    assert.deepEqual(lines,["'s-Hertogenbosch"])
})
test('break before', async () => {
    let lines = linebreak("Idlewild Airport",15)
    assert.deepEqual(lines,["Idlewild","Airport"])
})
test('break after', async () => {
    let lines = linebreak("Idlewildgenbosch Airport",15)
    assert.deepEqual(lines,["Idlewildgenbosch","Airport"])
})

test('multiple breaks', async () => {
    let lines = linebreak("Idlewildgenbosch Idlewildgenbosch Idlewildgenbosch",15)
    assert.deepEqual(lines,["Idlewildgenbosch","Idlewildgenbosch","Idlewildgenbosch"])
})

test('very long break', async () => {
    let lines = linebreak("Dorotheenstädtisch-Friedrichswerderscher und Französischer Friedhof",15)
    assert.deepEqual(lines,["Dorotheenstädtisch-Friedrichswerderscher","und Französischer","Friedhof"])
})

test('fontspec', async () => {
    let f = new FontSpec({font:"12px serif"})
    assert.equal(f.str(),"12px serif")

    f = new FontSpec({font:z => { return z == 1 ? "12px serif" : "14px serif"}})
    assert.equal(f.str(1),"12px serif")
    assert.equal(f.str(2),"14px serif")

    f = new FontSpec({fontFamily:"serif",fontWeight:500,fontStyle:"italic",fontSize:14})
    assert.equal(f.str(1),"italic 500 14px serif")

    f = new FontSpec({})
    assert.equal(f.str(1),"12px sans-serif")

    f = new FontSpec({fontWeight: z => { return z == 1 ? 400 : 600 }})
    assert.equal(f.str(1),"400 12px sans-serif")
    assert.equal(f.str(2),"600 12px sans-serif")

    f = new FontSpec({fontSize: z => { return z == 1 ? 12 : 14 }})
    assert.equal(f.str(1),"12px sans-serif")
    assert.equal(f.str(2),"14px sans-serif")

    f = new FontSpec({fontStyle: z => { return z == 1 ? "normal" : "italic" }})
    assert.equal(f.str(1),"normal 12px sans-serif")
    assert.equal(f.str(2),"italic 12px sans-serif")

    f = new FontSpec({fontFamily: z => { return z == 1 ? "sans-serif" : "serif" }})
    assert.equal(f.str(1),"12px sans-serif")
    assert.equal(f.str(2),"12px serif")
})

test ('textspec', async () => {
    let t = new TextSpec()
    assert.equal(t.str(0,{name:"臺北"}),"臺北")
    t = new TextSpec({properties:["name:en"]})
    assert.equal(t.str(0,{'name:en':"Taipei",'name':"臺北"}),"Taipei")
    t = new TextSpec({properties:["name:en"],textTransform:"uppercase"})
    assert.equal(t.str(0,{'name:en':"Taipei"}),"TAIPEI")
    t = new TextSpec({properties:["name:en"],textTransform:"uppercase"})
    assert.equal(t.str(0,{}),undefined)
})

export default test