import { exp } from '../src/symbolizer'

test('exp',() => {
    let result = exp(5,1.4,[[5,1.5],[11,4],[16,30]])
    expect(result).toStrictEqual(1.5)
    result = exp(11,1.4,[[5,1.5],[11,4],[16,30]])
    expect(result).toStrictEqual(4)
    result = exp(16,1.4,[[5,1.5],[11,4],[16,30]])
    expect(result).toStrictEqual(30)
    result = exp(12,1,[[5,1.5],[11,4],[13,6]])
    expect(result).toStrictEqual(5)
})