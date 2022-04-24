declare var L: any;

import Point from "@mapbox/point-geometry";

import { Zxy, TileCache } from "../tilecache";
import { View, PreparedTile, sourcesToViews } from "../view";
import { painter } from "../painter";
import { Labelers } from "../labeler";
import { light } from "../default_style/light";
import { dark } from "../default_style/dark";
import { paintRules, labelRules } from "../default_style/style";
import { xray_rules } from "../xray";

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
type Status = {
  status: string;
  value?: any;
  reason: Error;
};
const reflect = (promise: Promise<Status>) => {
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
      this.tasks = options.tasks || [];

      this.views = sourcesToViews(options);

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
      this.tileDelay = options.tileDelay || 3;
      this.lang = options.lang;

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

      let promises = [];
      for (const [k, v] of this.views) {
        let promise = v.getDisplayTile(coords);
        promises.push({ key: k, promise: promise });
      }
      let tile_responses = await Promise.all(
        promises.map((o) => {
          return o.promise.then(
            (v: PreparedTile[]) => {
              return { status: "fulfilled", value: v, key: o.key };
            },
            (error: Error) => {
              return { status: "rejected", reason: error, key: o.key };
            }
          );
        })
      );

      let prepared_tilemap = new Map<string, PreparedTile[]>();
      for (const tile_response of tile_responses) {
        if (tile_response.status === "fulfilled") {
          prepared_tilemap.set(tile_response.key, [tile_response.value]);
        }
      }

      if (element.key != key) return;
      if (this.lastRequestedZ !== coords.z) return;

      await Promise.all(this.tasks.map(reflect));

      if (element.key != key) return;
      if (this.lastRequestedZ !== coords.z) return;

      let layout_time = this.labelers.add(coords.z, prepared_tilemap);

      if (element.key != key) return;
      if (this.lastRequestedZ !== coords.z) return;

      let label_data = this.labelers.getIndex(coords.z);

      if (!this._map) return; // the layer has been removed from the map

      let center = this._map.getCenter().wrap();
      let pixelBounds = this._getTiledPixelBounds(center),
        tileRange = this._pxBoundsToTileRange(pixelBounds),
        tileCenter = tileRange.getCenter();
      let priority = coords.distanceTo(tileCenter) * this.tileDelay;

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

      element.width = this.tile_size;
      element.height = this.tile_size;
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

      let paint_rules = this.paint_rules;
      if (this.xray) {
        paint_rules = xray_rules(prepared_tilemap, this.xray);
      }

      painting_time = painter(
        ctx,
        coords.z,
        prepared_tilemap,
        this.xray ? null : label_data,
        paint_rules,
        bbox,
        origin,
        false,
        this.debug
      );

      if (this.debug) {
        ctx.save();
        ctx.fillStyle = this.debug;
        ctx.font = "600 12px sans-serif";
        ctx.fillText(coords.z + " " + coords.x + " " + coords.y, 4, 14);

        ctx.font = "12px sans-serif";
        let ypos = 28;
        for (let [k, v] of prepared_tilemap) {
          let dt = v[0].data_tile;
          ctx.fillText(
            k + (k ? " " : "") + dt.z + " " + dt.x + " " + dt.y,
            4,
            ypos
          );
          ypos += 14;
        }

        ctx.font = "600 10px sans-serif";
        if (painting_time > 8) {
          ctx.fillText(painting_time.toFixed() + " ms paint", 4, ypos);
          ypos += 14;
        }

        if (layout_time > 8) {
          ctx.fillText(layout_time.toFixed() + " ms layout", 4, ypos);
        }
        ctx.strokeStyle = this.debug;

        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 256);
        ctx.stroke();

        ctx.lineWidth = 0.5;
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
      let element = L.DomUtil.create("canvas", "leaflet-tile");
      element.lang = this.lang;

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
      L.DomUtil.removeClass(tile.el, "leaflet-tile-loaded");
      tile.el.width = tile.el.height = 0;
      L.DomUtil.remove(tile.el);
      delete this._tiles[key];
      this.fire("tileunload", {
        tile: tile.el,
        coords: this._keyToTileCoords(key),
      });
    }

    public queryFeatures(lng: number, lat: number) {
      let featuresBySourceName = new Map();
      for (var [sourceName, view] of this.views) {
        featuresBySourceName.set(
          sourceName,
          view.queryFeatures(lng, lat, this._map.getZoom())
        );
      }
      return featuresBySourceName;
    }

    public inspect(layer: LeafletLayer) {
      return (ev: any) => {
        let typeGlyphs = ["◎", "⟍", "◻"];
        let wrapped = layer._map.wrapLatLng(ev.latlng);
        let resultsBySourceName = layer.queryFeatures(wrapped.lng, wrapped.lat);
        var content = "";
        let firstRow = true;

        for (var [sourceName, results] of resultsBySourceName) {
          for (var result of results) {
            if (this.xray && this.xray !== true) {
              if (
                !(
                  (this.xray.dataSource || "") === sourceName &&
                  this.xray.dataLayer === result.layerName
                )
              ) {
                continue;
              }
            }
            content =
              content +
              `<div style="margin-top:${firstRow ? 0 : 0.5}em">${
                typeGlyphs[result.feature.geomType - 1]
              } <b>${sourceName} ${sourceName ? "/" : ""} ${
                result.layerName
              }</b> ${result.feature.id || ""}</div>`;
            for (const prop in result.feature.props) {
              content =
                content +
                `<div style="font-size:0.9em">${prop} = ${result.feature.props[prop]}</div>`;
            }
            firstRow = false;
          }
        }
        if (firstRow) {
          content = "No features.";
        }
        L.popup()
          .setLatLng(ev.latlng)
          .setContent(
            '<div style="max-height:400px;overflow-y:scroll;padding-right:8px">' +
              content +
              "</div>"
          )
          .openOn(layer._map);
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
