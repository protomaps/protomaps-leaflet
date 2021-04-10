import linelabel from 'linelabel/xy'

export function simpleLabel(mls:any,minimum:number) {
    let longestStart
    let longestEnd
    let longestLength = 0
    for (let ls of mls) {
        let segments = linelabel(ls,Math.PI/2/9) // 10 degrees
        for (let segment of segments) {
            if (segment.length >= minimum && segment.length > longestLength) {
                longestLength = segment.length
                longestStart = ls[segment.beginIndex]
                longestEnd = ls[segment.endIndex-1]
            }
        }
    }
    if (!longestStart) return undefined
    return {start:longestStart,end:longestEnd}
}