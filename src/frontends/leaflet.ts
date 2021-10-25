declare var L: any;

// @ts-ignore
import Point from "@mapbox/point-geometry";

import { ZxySource, Zxy, PmtilesSource, TileCache } from "../tilecache";
import { View } from "../view";
import { painter, xray } from "../painter";
import { Labelers } from "../labeler";
import { light } from "../default_style/light";
import { dark } from "../default_style/dark";
import { paintRules, labelRules } from "../default_style/style";

class CanvasPool {
  unused: any[];
  lang: string;

  constructor(lang: string) {
    this.lang = lang;
    this.unused = [];
  }

  public get(tile_size: number) {
    if (this.unused.length) {
      let tile = this.unused.shift();
      tile.removed = false;
      return tile;
    }
    let element = L.DomUtil.create("canvas", "leaflet-tile");
    element.width = tile_size;
    element.height = tile_size;
    element.lang = this.lang;
    return element;
  }

  public put(elem: any) {
    L.DomUtil.removeClass(elem, "leaflet-tile-loaded");
    this.unused.push(elem);
  }
}

const timer = (duration: number) => {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, duration);
  });
};

// replacement for Promise.allSettled (requires ES2020+)
// this is called for every tile render,
// so ensure font loading failure does not make map rendering fail
const reflect = (promise) => {
  return promise.then(
    (v) => {
      return { status: "fulfilled", value: v };
    },
    (error) => {
      return { status: "rejected", reason: error };
    }
  );
};

const leafletLayer = (options: any): any => {
  class LeafletLayer extends L.GridLayer {
    constructor(options: any) {
      if (options.noWrap && !options.bounds)
        options.bounds = [
          [-90, -180],
          [90, 180],
        ];
      if (options.attribution == null)
        options.attribution =
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';
      super(options);

      let theme = options.dark ? dark : light;
      this.paint_rules =
        options.paint_rules || paintRules(theme, options.shade);
      this.label_rules =
        options.label_rules ||
        labelRules(theme, options.shade, options.language1, options.language2);
      this.backgroundColor = options.backgroundColor;
      this.lastRequestedZ = undefined;
      this.xray = options.xray;

      let source;
      if (options.url.url) {
        source = new PmtilesSource(options.url, true);
      } else if (options.url.endsWith(".pmtiles")) {
        source = new PmtilesSource(options.url, true);
      } else {
        source = new ZxySource(options.url, true);
      }

      let maxDataZoom = 14;
      if (options.maxDataZoom) {
        maxDataZoom = options.maxDataZoom;
      }

      this.levelDiff = options.levelDiff === undefined ? 2 : options.levelDiff;

      this.tasks = options.tasks || [];
      let cache = new TileCache(source, (256 * 1) << this.levelDiff);
      this.view = new View(cache, maxDataZoom, this.levelDiff);
      this.debug = options.debug;
      let scratch = document.createElement("canvas").getContext("2d");
      this.scratch = scratch;
      this.onTilesInvalidated = (tiles: Set<string>) => {
        tiles.forEach((t) => {
          this.rerenderTile(t);
        });
      };
      this.labelers = new Labelers(
        this.scratch,
        this.label_rules,
        16,
        this.onTilesInvalidated
      );
      this.tile_size = 256 * window.devicePixelRatio;
      this.pool = new CanvasPool(options.lang);

      // bound instance of function
      this.inspector = this.inspect(this);
    }

    public setDefaultStyle(
      darkOption: boolean,
      shade: string,
      language1: string[],
      language2: string[]
    ) {
      let theme = darkOption ? dark : light;
      this.paint_rules = paintRules(theme, shade);
      this.label_rules = labelRules(theme, shade, language1, language2);
    }

    public async renderTile(
      coords: any,
      element: any,
      key: string,
      done = () => {}
    ) {
      this.lastRequestedZ = coords.z;
      var prepared_tile;
      try {
        prepared_tile = await this.view.getDisplayTile(coords);
      } catch (e) {
        if (e.name == "AbortError") return;
        else throw e;
      }

      if (element.key != key) return;
      if (this.lastRequestedZ !== coords.z) return;

      await Promise.all(this.tasks.map(reflect));

      if (element.key != key) return;
      if (this.lastRequestedZ !== coords.z) return;

      let layout_time = await this.labelers.add(prepared_tile);

      if (element.key != key) return;
      if (this.lastRequestedZ !== coords.z) return;

      let label_data = this.labelers.getIndex(prepared_tile.z);

      if (!this._map) return; // the layer has been removed from the map

      let center = this._map.getCenter().wrap();
      let pixelBounds = this._getTiledPixelBounds(center),
        tileRange = this._pxBoundsToTileRange(pixelBounds),
        tileCenter = tileRange.getCenter();
      let priority = coords.distanceTo(tileCenter) * 5;

      await timer(priority);

      if (element.key != key) return;
      if (this.lastRequestedZ !== coords.z) return;

      let BUF = 16;
      let bbox = {
        minX: 256 * coords.x - BUF,
        minY: 256 * coords.y - BUF,
        maxX: 256 * (coords.x + 1) + BUF,
        maxY: 256 * (coords.y + 1) + BUF,
      };
      let origin = new Point(256 * coords.x, 256 * coords.y);

      let ctx = element.getContext("2d");
      ctx.setTransform(this.tile_size / 256, 0, 0, this.tile_size / 256, 0, 0);
      ctx.clearRect(0, 0, 256, 256);

      if (this.backgroundColor) {
        ctx.save();
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, 256, 256);
        ctx.restore();
      }

      var painting_time = 0;
      if (this.xray) {
        painting_time = xray(
          ctx,
          [prepared_tile],
          bbox,
          origin,
          false,
          this.debug
        );
      } else {
        painting_time = painter(
          ctx,
          [prepared_tile],
          label_data,
          this.paint_rules,
          bbox,
          origin,
          false,
          this.debug
        );
      }

      if (this.debug) {
        let data_tile = prepared_tile.data_tile;
        ctx.save();
        ctx.fillStyle = this.debug;
        ctx.font = "600 12px sans-serif";
        ctx.fillText(coords.z + " " + coords.x + " " + coords.y, 4, 14);
        ctx.font = "200 12px sans-serif";
        ctx.fillText(
          data_tile.z + " " + data_tile.x + " " + data_tile.y,
          4,
          28
        );
        ctx.font = "600 10px sans-serif";
        if (painting_time > 8) {
          ctx.fillText(painting_time.toFixed() + " ms paint", 4, 42);
        }
        if (layout_time > 8) {
          ctx.fillText(layout_time.toFixed() + " ms layout", 4, 56);
        }
        ctx.strokeStyle = this.debug;

        ctx.lineWidth =
          coords.x / (1 << this.levelDiff) === data_tile.x ? 2.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 256);
        ctx.stroke();

        ctx.lineWidth =
          coords.y / (1 << this.levelDiff) === data_tile.y ? 2.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(256, 0);
        ctx.stroke();

        ctx.restore();
      }
      done();
    }

    public rerenderTile(key: string) {
      for (let unwrapped_k in this._tiles) {
        let wrapped_coord = this._wrapCoords(
          this._keyToTileCoords(unwrapped_k)
        );
        if (key === this._tileCoordsToKey(wrapped_coord)) {
          this.renderTile(wrapped_coord, this._tiles[unwrapped_k].el, key);
        }
      }
    }

    public clearLayout() {
      this.labelers = new Labelers(
        this.scratch,
        this.label_rules,
        16,
        this.onTilesInvalidated
      );
    }

    public rerenderTiles() {
      for (let unwrapped_k in this._tiles) {
        let wrapped_coord = this._wrapCoords(
          this._keyToTileCoords(unwrapped_k)
        );
        let key = this._tileCoordsToKey(wrapped_coord);
        this.renderTile(wrapped_coord, this._tiles[unwrapped_k].el, key);
      }
    }

    public createTile(coords: any, showTile: any) {
      let element = this.pool.get(this.tile_size);
      let key = this._tileCoordsToKey(coords);
      element.key = key;

      this.renderTile(coords, element, key, () => {
        showTile(null, element);
      });

      return element;
    }

    public _removeTile(key: string) {
      let tile = this._tiles[key];
      if (!tile) {
        return;
      }
      tile.el.removed = true;
      tile.el.key = undefined;
      L.DomUtil.remove(tile.el);
      this.pool.put(tile.el);
      delete this._tiles[key];
      this.fire("tileunload", {
        tile: tile.el,
        coords: this._keyToTileCoords(key),
      });
    }

    public queryFeatures(lng: number, lat: number) {
      return this.view.queryFeatures(lng, lat, this._map.getZoom());
    }

    public inspect(layer: LeafletLayer) {
      return (ev: any) => {
        let typeNames = ["Point", "Line", "Polygon"];
        let wrapped = layer._map.wrapLatLng(ev.latlng);
        let results = layer.queryFeatures(wrapped.lng, wrapped.lat);
        var content = "";
        for (var i = 0; i < results.length; i++) {
          let result = results[i];
          content =
            content +
            `<div><b>${result.layerName}</b> ${
              typeNames[result.feature.geomType - 1]
            } ${result.feature.id}</div>`;
          for (const prop in result.feature.props) {
            content =
              content + `<div>${prop}=${result.feature.props[prop]}</div>`;
          }
          if (i < results.length - 1) content = content + "<hr/>";
        }
        if (results.length == 0) {
          content = "No features.";
        }
        L.popup().setLatLng(ev.latlng).setContent(content).openOn(layer._map);
      };
    }

    public addInspector(map: any) {
      return map.on("click", this.inspector);
    }

    public removeInspector(map: any) {
      return map.off("click", this.inspector);
    }
  }
  return new LeafletLayer(options);
};

export { leafletLayer };
