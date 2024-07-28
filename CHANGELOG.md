# 4.0.0
* switch to tsup for generating ESM, CJS and IIFE modules [#158, #161, #162].
* should fix import issues related to typescript.
* IIFE script name changed from `protomaps-leaflet.min.js` to `protomaps-leaflet.js`
* generate ESM and CJS builds unbundled. iife is still unbundled.
* remove use of default exports: theme.ts exports `theme`
* bump internal dependencies.

# 3.1.2
* Fix pmtiles URL detection on relative paths [#152]

# 3.1.1
* Detect pmtiles URLs by using URL parsing, which handles query parameters [#147]

# 3.1.0
* add `queryTileFeaturesDebug` back in for basic interactions (You should use MapLibre if you want interactivity)

# 3.0.0

* Unexport `PMTiles` because you shouldn't be depending on the one bundled in this library.
* Bump `pmtiles` dependency to v3.x
* package.json defaults to ES6.
* remove CubicBezier function as no longer used.

# 2.0.0

Major version 2.0 aggressively reduces the scope of this rendering library.

This library re-focuses on being a Leaflet plugin for vector tile basemaps, i.e. "Mapnik in the browser"

* **All user interaction features are removed.** Every mapping application with clickable features should use MapLibre GL JS.

* **MapLibre JSON style compatibility is removed.** The surface area of the JSON style is too large to maintain for real-world use cases, and styles written for MapLibre perform poorly with this library.

* **Programmatic shading and extra basemap styles are removed.** This library's default style aligns with the 5 MapLibre styles developed in protomaps/basemaps.

* `levelDiff` is no longer configurable and defaults to 1 to match MapLibre GL.

* consistent camelCase naming e.g. `paint_rules` -> `paintRules`

* You must pass one of the default basemap themes `light, dark, white, black, grayscale`. remove `dark` and `shade` options.

* Remove WebKit vertex count workaround.

* remove `PolygonLabelSymbolizer` as it is not accurate for tiled rendering.

* `maxDataZoom` defaults to 15.

* Use Protomaps basemap tileset v3 instead of v2. 

* remove `setDefaultStyle` method.

* remove multi-language `language1`, `language2`: frontends take a single `language` parameter.


# 1.24.2
* Continue internal refactors in preparation of 2.0.0 major revision.

# 1.24.1
* Apply linting rules; fix scoping and equality problems caught by linter.

# 1.24.0
* library renamed from `protomaps` to `protomaps-leaflet`, including npm package.

# 1.23
* bump `pmtiles` to 2.6.1.

# 1.22
* fix type of multiple `Source`s passed into leaflet layer or static map.

# 1.21
* support pmtiles v3.

# 1.20.2
* missing tiles in PMTiles archive do not show a browser error

# 1.20.1
* Fix stroking of circle symbolizer
* Fix static map `drawCanvasBounds` and `drawContextBounds` coordinate order

# 1.20.0
* Fix labeling-across-tiles bug introduced in 1.19.0
* Support for vector PMTiles with compression

# 1.19.0
* Multiple vector tile sources in a single layer

# 1.18.2
* Fix missing last stroke of `PolygonSymbolizer`
* make css-font-loading-module a dependency for types to be findable

# 1.18.0
* Sprites module formerly under `protosprites` package merged into this project

# 1.16.0
* Set canvas size to 0,0 before garbage collection, workaround for Safari

# 1.15.0
* Type improvements for Symbolizers, thanks nf-s
* add additional TextTransforms
* LineLabelSymbolizer features, step interpolation features, label deduplication

# 1.14.0
* Label repetition for lines
* Limit label repetition when overzooming

# 1.13.0
* `PolygonSymbolizer` has `stroke` and `width` for efficient outlines.
* `maxLineChars` line-breaking can be a function.

# 1.12.0
* `Static` takes same basic options as leaflet frontend.

# 1.10.0
* `backgroundColor` option for leaflet or static map.

# 1.9.0
* Center text justification only in the case of `CenterdSymbolizer`
* `TextSymbolizer` `label_props` can be a function
* `LineSymbolizer` `lineJoin` and `lineCap` attributes

# 1.8.0
* add `Padding` generic label symbolizer

# 1.7.0
* `TextSymbolizer` attributes: `lineHeight` in `em`, `letterSpacing` in `px`
* add `linear` and `step` shortcut functions for zoom-based styling

# 1.6.0
* add `removeInspector`

# 1.5.0
* `levelDiff` option to set ratio of display tiles to data tiles.

# 1.4.0
* Feature picking more accurate; uses distance-to-line and point-in-polygon.
* `xray` option to show all layers.

# 1.3.0
* `addInspector` to click on features and show an information popup.

# 1.2.0
* Label symbolizers for point and polygon features take the same set of attributes for text display.
* Add maxLineChars to define line breaking by maximum [code units](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length)

# 1.1.0
PickedFeature in queryFeatures returns object with LayerName and feature.

# 1.0.0

* Most color and numerical Symbolizer attributes can now be treated as evaluated properties, with parameters (zoom:number,feature:Feature)
* `Rule` filters parameters changed from (properties:any) to (zoom:number,feature:Feature) to enable filtering on zoom level and geom_type.
* `Feature.properties` renamed to `Feature.props` for brevity
* Internal `PaintSymbolizer.draw` signature now takes zoom as third parameter.
* `properties` for defining fallbacks for text in label Symbolizers renamed to `label_props` e.g. ["name:en","name"]
