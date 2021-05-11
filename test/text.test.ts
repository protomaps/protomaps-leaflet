import { linebreak, FontSpec } from '../src/text'

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

test('fontspec', () => {
    let f = new FontSpec({font:"12px serif"})
    expect(f.str()).toStrictEqual("12px serif")

    f = new FontSpec({font:z => { return z == 1 ? "12px serif" : "14px serif"}})
    expect(f.str(1)).toStrictEqual("12px serif")
    expect(f.str(2)).toStrictEqual("14px serif")
})