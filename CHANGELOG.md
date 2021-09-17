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
