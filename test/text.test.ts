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

export default test