import { linebreak } from '../src/text'

test('trivial',() => {
    let lines = linebreak("foo",15)
    expect(lines).toStrictEqual(["foo"])
})
test('no break', () => {
    let lines = linebreak("'s-Hertogenbosch",15)
    expect(lines).toStrictEqual(["'s-Hertogenbosch"])
})
test('break before', () => {
    let lines = linebreak("Idlewild Airport",15)
    expect(lines).toStrictEqual(["Idlewild","Airport"])
})
test('break after', () => {
    let lines = linebreak("Idlewildgenbosch Airport",15)
    expect(lines).toStrictEqual(["Idlewildgenbosch","Airport"])
})

test('multiple breaks', () => {
    let lines = linebreak("Idlewildgenbosch Idlewildgenbosch Idlewildgenbosch",15)
    expect(lines).toStrictEqual(["Idlewildgenbosch","Idlewildgenbosch","Idlewildgenbosch"])
})