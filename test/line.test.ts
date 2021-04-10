import { simpleLabel } from '../src/line'

test('simple line labeler', () => {
    let mls = [[{x:0,y:0},{x:100,y:0}]]
    let result = simpleLabel(mls,10)
    expect(result.start).toEqual({x:0,y:0})
    expect(result.end).toEqual({x:100,y:0})

    mls = [[{x:0,y:50},{x:0,y:0},{x:100,y:0},{x:200,y:5}]]
    result = simpleLabel(mls,10)
    expect(result.start).toEqual({x:0,y:0})
    expect(result.end).toEqual({x:200,y:5})
})

test('too small', () => {
    let mls = [[{x:0,y:0},{x:10,y:0}]]
    let result = simpleLabel(mls,20)
    expect(result).toBeUndefined()
})
