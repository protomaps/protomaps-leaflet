import { PolygonSymbolizer, LineSymbolizer, LineLabelSymbolizer, TextSymbolizer, exp } from './../symbolizer'

export function filterFn(arr) {
    // hack around "$type"
    if (arr.includes("$type")) {
        return f => true 
    } else if (arr[0] == "==") {
        return f => f[arr[1]] === arr[2]
    } else if (arr[0] == "!=") {
        return f => f[arr[1]] !== arr[2]
    } else if (arr[0] === "<") {
        return f => f[arr[1]] < arr[2]
    } else if (arr[0] === ">") {
        return f => f[arr[1]] > arr[2]
    } else if (arr[0] === "in") {
        return f => arr.slice(2,arr.length).includes(f[arr[1]])
    } else if (arr[0] === "!in") {
        return f => !arr.slice(2,arr.length).includes(f[arr[1]])
    } else if (arr[0] === "has") {
        return f => f.hasOwnProperty(arr[1])
    } else if (arr[0] === "all") {
        let parts = arr.slice(1,arr.length).map(e => filterFn(e))
        return f => parts.every(p => { return p(f)})
    } else if (arr[0] === "any") {
        let parts = arr.slice(1,arr.length).map(e => filterFn(e))
        return f => parts.some(p => { return p(f) })
    } else {
        console.log("Unimplemented: ",arr[0])
    }
}

export function numberFn(obj) {
    if (!obj) return obj
    if (typeof obj == "number") {
        return obj
    } 
    if (obj.base && obj.stops) {
        return exp(obj.base,obj.stops)
    } else {
        console.log("Unimplemented: ", obj)
    }
}

export function getFont(obj,mapping = {}) {
    let fontfaces = []
    for (let wanted_face of obj['text-font']) {
        if (mapping.hasOwnProperty(wanted_face)) {
            fontfaces.push(mapping[wanted_face])
        }
    }
    if (fontfaces.length === 0) fontfaces.push('sans-serif')

    let text_size = obj['text-size']
    if (typeof text_size == 'number') {
        return `${text_size}px ${fontfaces.join(', ')}`
    } else if (text_size.stops) {
        var base = 1.4
        if(text_size.base) base = text_size.base
        return z => {
            let t = numberFn(text_size)
            return `${t(z)}px ${fontfaces.join(', ')}`
        }
    } else {
        console.log("Can't parse font: ", obj)
    }
}

export function json_style(obj) {
    let paint_style = []
    let label_style = []
    let refs = new Map<string,any>()

    for (var layer of obj.layers) {
        refs.set(layer.id,layer)

        if (layer.layout && layer.layout.visibility == "none") {
            continue
        }

        if (layer.ref) {
           let referenced = refs.get(layer.ref)
           layer.type = referenced.type
           layer.filter = referenced.filter
           layer.source = referenced['source']
           layer['source-layer'] = referenced['source-layer']
        }

        let sourceLayer = layer['source-layer']
        var symbolizer

        var filter = undefined
        if (layer.filter) {
            filter = filterFn(layer.filter)
        }

        // ignore background-color?
        if (layer.type == "fill") {
            paint_style.push({
                dataLayer: layer['source-layer'],
                filter:filter,
                symbolizer: new FillSymbolizer({
                    fill:layer.paint['fill-color'],
                    opacity:layer.paint['fill-opacity']
                })
            })
        } else if (layer.type == "line") {
            paint_style.push({
                dataLayer: layer['source-layer'],
                filter:filter,
                symbolizer: new LineSymbolizer({
                    color:layer.paint['line-color'],
                    width:numberFn(layer.paint["line-width"])
                })
            })
        } else if (layer.type == "symbol") {
            if (layer.layout["symbol-placement"] == "line") {
                label_style.push({
                    dataLayer: layer['source-layer'],
                    filter:filter,
                    symbolizer: new LineLabelSymbolizer({
                        fill:layer.paint['text-color'],
                        width:layer.paint['text-halo-width'],
                        stroke:layer.paint['text-halo-color']
                    })
                })
            } else {
                label_style.push({
                    dataLayer: layer['source-layer'],
                    filter:filter,
                    symbolizer: new TextSymbolizer({
                        font: getFont(layer.layout),
                        fill: layer.paint['text-color'],
                        stroke: layer.paint['text-halo-color'],
                        width:layer.paint['text-halo-width']
                    })
                })
            }
        }
    }

    return {paint_style:paint_style,label_style:label_style}
}