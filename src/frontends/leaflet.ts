declare var L: any

import { ZxySource, PmtilesSource, TileCache } from '../tilecache'
import { Subview } from '../view'
import { painter } from '../painter'
import { Labelers } from '../labeler'
import { paint_style as lightPaint, label_style as lightLabel } from '../default_style/light'
import { paint_style as darkPaint, label_style as darkLabel } from '../default_style/dark'

class CanvasPool {
    unused: any[]

    constructor() {
        this.unused = []
    }

    public get(tile_size,clickHandler) {
        if (this.unused.length) {
            let  foo = this.unused.shift()
            foo.removed = false
            return foo
        }
        let element = L.DomUtil.create('canvas', 'leaflet-tile')
        element.width = tile_size
        element.height = tile_size
        // element.style.pointerEvents = "initial"
        // L.DomEvent.on(element,"click",event => {
        //     clickHandler(event)
        // })
        // element.lang = this.lang
        return element
    }

    public put(elem) {
        L.DomEvent.off("click")
        L.DomUtil.removeClass(elem,'leaflet-tile-loaded')
        this.unused.push(elem)
    }
}

class LeafletLayer extends L.GridLayer {
    constructor(options) {
        if (options.noWrap && !options.bounds) options.bounds = [[-90,-180],[90,180]]
        super(options)
        this.paint_style = options.paint_style || (options.dark ? darkPaint : lightPaint)
        this.label_style = options.label_style || (options.dark ? darkLabel : lightLabel)

        let source
        if (options.url.endsWith(".pmtiles")) {
            source = new PmtilesSource(options.url,{allow_200:options.allow_200})
        } else {
            source = new ZxySource(options.url)
        }

        let cache = new TileCache(source)
        this.view = new Subview(cache,14,4096,2,256)
        this.debug = options.debug || false
        this.lang = options.lang
        let scratch = document.createElement('canvas').getContext('2d')
        this.knockoutTiles = (tiles) => {
            tiles.forEach(t => {
                this.rerenderTile(t)
            })
        }
        this.labelers = new Labelers(this.view,scratch, this.label_style, this.knockoutTiles)
        this.tile_size = 256 *window.devicePixelRatio
        this.pool = new CanvasPool()
        this._onClick = null
    }

    public onClick(callback) {
        this._onClick = callback
    }

    public async renderTile(coords,element,key,done = ()=>{}) {
        let state = {element:element,tile_size:this.tile_size,ctx:null}
        var paint_data, label_data
        try {
            paint_data = await this.view.get(coords)
            label_data = await this.labelers.get(coords)
        } catch(e) {
            return
        }

        if (!this._map) {
            return // the layer has been removed from the map
        }

        let center = this._map.getCenter().wrap()
        var pixelBounds = this._getTiledPixelBounds(center),
             tileRange = this._pxBoundsToTileRange(pixelBounds),
             tileCenter = tileRange.getCenter()
        let priority = coords.distanceTo(tileCenter) * 10

        setTimeout(() => {
            let painting_time = painter(state,key,paint_data,label_data,this.paint_style,this.debug)

            if (this.debug) {
                let ctx = state.ctx
                if (!ctx) return
                let data_tile = this.view.dataTile(coords)
                ctx.save()
                ctx.fillStyle = "black"
                ctx.globalAlpha = 0.5
                ctx.fillStyle = "#000"
                ctx.font = '800 12px sans-serif';
                ctx.fillText(coords.z + " " + coords.x + " " + coords.y,4,14)

                if ((data_tile.x % 2 + data_tile.y % 2) % 2 == 0) {
                    ctx.fillStyle = "black"
                } else {
                    ctx.fillStyle = "blue"
                }

                ctx.fillText(data_tile.z + " " + data_tile.x + " " + data_tile.y,4,28)

                ctx.fillStyle = "red"
                if (painting_time > 8) {
                    ctx.fillText(painting_time.toFixed() + " ms",4,42)
                }
                ctx.strokeStyle = "#000"
                ctx.strokeRect(0,0,256,256)
                ctx.restore()
            }
            done()
        },priority)
    }

    public rerenderTile(key) {
        for (var unwrapped_k in this._tiles) {
            let wrapped_coord = this._wrapCoords(this._keyToTileCoords(unwrapped_k))
            if (key === this._tileCoordsToKey(wrapped_coord)) {
                this.renderTile(wrapped_coord,this._tiles[unwrapped_k].el,key)
            }
        }
    }

    public rerenderTiles() {
        for (var unwrapped_k in this._tiles) {
            let wrapped_coord = this._wrapCoords(this._keyToTileCoords(unwrapped_k))
            let key = this._tileCoordsToKey(wrapped_coord)
            this.renderTile(wrapped_coord,this._tiles[unwrapped_k].el,key)
        }
    }

    public createTile(coords,showTile) {
        let element = this.pool.get(this.tile_size,event =>  {
            let latlng = this._map.mouseEventToLatLng(event)
            this.view.within(coords,event.offsetX,event.offsetY).then(nearby => {
                this._onClick(latlng, nearby)
            })
        })

        let key = this._tileCoordsToKey(coords)
        element.key = key

        this.renderTile(coords,element,key,() => {
            showTile(null,element)
        })

        return element
    }

    public _removeTile(key) {
        var tile = this._tiles[key];
        if (!tile) { return; }
        tile.el.removed = true
        tile.el.key = undefined
        L.DomUtil.remove(tile.el);
        this.pool.put(tile.el)
        delete this._tiles[key];
        this.fire('tileunload', {
            tile: tile.el,
            coords: this._keyToTileCoords(key)
        });
    }
}

export { LeafletLayer }