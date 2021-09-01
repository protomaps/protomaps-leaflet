# 1.0.0

* Most color and numerical Symbolizer attributes can now be treated as evaluated properties, with parameters (zoom:number,feature:Feature)
* `Rule` filters parameters changed from (properties:any) to (zoom:number,feature:Feature) to enable filtering on zoom level and geom_type.
* `Feature.properties` renamed to `Feature.props` for brevity
* Internal `PaintSymbolizer.draw` signature now takes zoom as third parameter.
* `properties` for defining fallbacks for text in label Symbolizers renamed to `label_props` e.g. ["name:en","name"]
