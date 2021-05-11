import { exp } from '../src/symbolizer'

test('exp',() => {
    let result = exp(1.4,[[5,1.5],[11,4],[16,30]])(5)
    expect(result).toStrictEqual(1.5)
    result = exp(1.4,[[5,1.5],[11,4],[16,30]])(11)
    expect(result).toStrictEqual(4)
    result = exp(1.4,[[5,1.5],[11,4],[16,30]])(16)
    expect(result).toStrictEqual(30)
    result = exp(1,[[5,1.5],[11,4],[13,6]])(12)
    expect(result).toStrictEqual(5)
})