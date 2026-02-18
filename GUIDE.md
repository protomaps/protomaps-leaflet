## Custom Vector Data

If you're bringing your own data created with a tool like [tippecanoe](/pmtiles/create), you'll need to write your own **Paint Rules** and **Label Rules** to visualize your tiles. You can re-use common visualization patterns with custom **Symbolizers**.

### My first rule

In protomaps-leaflet, the layers of a map are expressed using one or more **Rules**. A Rule is a JavaScript object that specifies a layer of data in the vector tile source, such as `water`, `buildings`, or `places`, as well as a **Symbolizer**, which determines how the geographic features are drawn to Canvas.

A very simple "hello world" map with one **Rule** is below.

```js
let PAINT_RULES = [
    {
        dataLayer:"water",
        symbolizer:new protomapsL.PolygonSymbolizer({fill:"steelblue"})
    } 
];

let LABEL_RULES = []; // ignore for now

protomapsL.leafletLayer({
    url:URL,
    paintRules:PAINT_RULES,
    labelRules:LABEL_RULES
}).addTo(map) 
```

### My first symbolizer

The previous code uses the class `protomapsL.PolygonSymbolizer` - but what does that do? `PolygonSymbolizer` is a pre-made symbolizer that takes a fill color as an argument, and conforms to the `PaintSymbolizer` *Interface*. 

A `PaintSymbolizer` just needs to have a method `draw`:

```js
class MyWaterSymbolizer {
    draw(context,geom,z,feature) {
        context.fillStyle = "dodgerblue"
        context.beginPath()
        for (var poly of geom) {
            for (var p = 0; p < poly.length-1; p++) {
                let pt = poly[p]
                if (p == 0) context.moveTo(pt.x,pt.y)
                else context.lineTo(pt.x,pt.y)
            }
        }
        context.fill()
    }
}

let PAINT_RULES = [
    {
        dataLayer:"water",
        symbolizer:new MyWaterSymbolizer()
    } 
]
```

The above dozen lines of code reads the vertices from `geom` and draws a polygon using the [Canvas 2D](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) methods like `beginPath` and `fill`. The coordinates x and y are all in CSS pixels; all scaling and transformation is handled for you by the library.


### Multiple rules

When multiple rules are specified, drawing proceeds from the start to the end. Rules that come later will be drawn over objects that come earlier. Let's add another symbolizer that draws point data from the layer `places` with a fill + a stroke, changes the color based on the feature properties, and only takes effect at zooms 12 and above:

```js
class MyPlaceSymbolizer {
    draw(context,geom,z,feature) {
        // console.log(properties)
        let pt = geom[0][0]
        var fill = "palegreen"
        if (feature.props.place == "suburb") fill = "lightgreen"
        if (feature.props.place == "city") fill = "mediumseagreen"
        context.fillStyle = fill
        context.strokeStyle = "black"
        context.beginPath()
        context.arc(pt.x,pt.y,4,0,2*Math.PI)
        context.stroke()
        context.fill() 
    }
}

let PAINT_RULES = [
    {
        dataLayer:"water",
        symbolizer:new MyWaterSymbolizer()
    },
    {
        dataLayer:"places",
        symbolizer:new MyPlaceSymbolizer(),
        minzoom: 12
    }
]
```

### Adding text labels

The obvious next step is to put **labels** on our map. Each of those `place` features in the above example has a `name` like "London", "Covent Garden" within `properties` that we can use to draw on the map - try commenting out the logging statement to see them in your console.

The Canvas 2D context object has `fillText` and `strokeText` methods we can use to draw the text label, with bottom left corner at the X,Y position of the point:

```js
class MyPlaceSymbolizer {
    draw(context,geom,z,feature) {
        let pt = geom[0][0]
        var font = "12px sans-serif"
        if (feature.props.place == "suburb") font = "500 14px sans-serif"
        if (feature.props.place == "city") font = "800 16px sans-serif"
        context.fillStyle = "darkslategray"
        context.font = font
        context.fillText(feature.props.name, pt.x,pt.y)
    }
}
```

Well, that doesn't look as nice as we hoped. There are a few issues:

* Labels can be arbitrarily wide based on the length of the text, and the tile-based map rendering might cut off the text midway.

* Labels overlap with each other.

To solve this, there's another Symbolizer interface called the `LabelSymbolizer`.

### The LabelSymbolizer

LabelSymbolizers have a more complex interface than PaintSymbolizers. Instead of having a `draw` method, they have a `place` method. `place` returns a bounding box that is tested against an internal layout. `place` also returns a [closure](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures) which is executed against the Canvas2D context only if the label is successfully placed.

LabelRules go into a separate list of passed into the layer via the `label_rules` key. When placing text labels, we usually need to determine the height and width of text to find the bounding box; this is possible via the canvas `measureText` method. There is a "scratch" canvas context provided via `layout.scratch`  used for doing this work.

```js
class MyPlaceSymbolizer {
    place(layout,geom,feature) {
        let pt = geom[0][0]
        let name = feature.props.name

        var font = "12px sans-serif"
        if (feature.props.place == "suburb") font = "500 14px sans-serif"
        if (feature.props.place == "city") font = "800 16px sans-serif"

        layout.scratch.font = font
        let metrics = layout.scratch.measureText(name)
        let width = metrics.width
        let ascent = metrics.actualBoundingBoxAscent
        let descent = metrics.actualBoundingBoxDescent
        let bbox = {minX:pt.x-width/2,minY:pt.y-ascent,maxX:pt.x+width/2,maxY:pt.y+descent}

        let draw = ctx => {
            ctx.font = font
            ctx.fillStyle = "darkslategray"
            ctx.fillText(name,-width/2,0)
        }
        return [{anchor:pt,bboxes:[bbox],draw:draw}]
    }
}

let LABEL_RULES = [
    {
        dataLayer:"places",
        symbolizer:new MyPlaceSymbolizer()
    }
]
```

The two core interfaces of PaintSymbolizer and LabelSymbolizer encompass all of the functionality of protomaps-leaflet. There are many **pre-built symbolizers** to handle advanced labeling features such as line breaking, dynamic label positioning or text on slanted paths, but if those are not sufficient you are at liberty to implement your own.

### Drawing order

protomaps-leaflet always operates in this order:

1. Fetch the tile data for the given display tile.

2. Run all LabelSymbolizers from first to last, filling the labels quadtree with bounding boxes.

3. Run all PaintSymbolizers from first to last, painting to the canvas from back to front.

4. Run all Label closures - the ordering is irrelevant as labels are non-overlapping.

The internal ordering of **step 2** has a large effect on which labels ultimately appear on the map. **High priority labels** should appear in separate rules before low priority labels; thus a "city" rule should appear before a "neighbourhood" rule. If there is intended label priority within a Rule, specify a `sort` function on a Rule - this will order the features internally before label layout happens.

Finally, there is a **cross-tile label resolution step** where a label with higher rule precedence can knock out labels with lower precedence when an adjacent tile is loaded. This **uses rule precedence only**, meaning that the final label layout is non-determinstic; it depends on which tile was loaded first.

