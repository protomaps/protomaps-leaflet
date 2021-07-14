// @ts-ignore
import Point from '@mapbox/point-geometry'
// @ts-ignore
import linelabel from 'linelabel/xy'

export function simpleLabel(mls:any,minimum:number) {
    let longestStart
    let longestEnd
    let longestLength = 0
    for (let ls of mls) {
        let segments = linelabel(ls,Math.PI/2/18) // 5 degrees
        for (let segment of segments) {
            if (segment.length >= minimum && segment.length > longestLength) {
                longestLength = segment.length
                longestStart = ls[segment.beginIndex]
                longestEnd = ls[segment.endIndex-1]
            }
        }
    }
    if (!longestStart) return undefined
    if (longestStart.x == longestEnd.x && longestStart.y == longestEnd.y) {
        return undefined
    }
    return {start:longestStart,end:longestEnd}
}

export function lineCells(a:Point,b:Point,length:number,spacing:number) {
    // determine function of line
    let dx = b.x - a.x
    let dy = b.y - a.y
    let dist = Math.sqrt(Math.pow(b.x-a.x,2)+Math.pow(b.y-a.y,2))

    let retval = []
    for (var i = spacing; i < length; i+=2*spacing) {
        let factor = i * 1/dist
        retval.push({x:a.x+factor*dx,y:a.y+factor*dy})
    }
    return retval
}