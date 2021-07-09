import { createPattern, PolygonSymbolizer, IconSymbolizer, ShieldSymbolizer, LineSymbolizer, CenteredTextSymbolizer, OffsetTextSymbolizer, GroupSymbolizer, CircleSymbolizer, PolygonLabelSymbolizer, LineLabelSymbolizer, exp } from '../symbolizer'

export interface DefaultStyleParams {
    earth:string
    glacier:string
    residential:string
    hospital:string
    cemetery:string
    school:string
    industrial:string
    wood:string
    grass:string
    park:string
    water:string
    sand:string
    buildings:string
    highwayCasing:string
    majorRoadCasing:string
    mediumRoadCasing:string
    minorRoadCasing:string
    highway:string
    majorRoad:string
    mediumRoad:string
    minorRoad:string
    boundaries:string
    mask:string,
    countryLabel:string,
    cityLabel:string,
    stateLabel:string,
    neighbourhoodLabel:string,
    landuseLabel:string,
    waterLabel:string,
    naturalLabel:string,
    roadsLabel:string,
    poisLabel:string
}

export const paintRules = (params:DefaultStyleParams) => {
    return [
        {
            dataLayer: "earth",
            symbolizer: new PolygonSymbolizer({
                fill:params.earth
            })
        },
        {
            dataLayer: "natural",
            symbolizer: new PolygonSymbolizer({
                fill:params.glacier
            }),
            filter: f => { return f.natural == "glacier" }
        },
        {
            dataLayer: "landuse",
            symbolizer: new PolygonSymbolizer({
                fill:params.residential
            }),
            filter:f => { return f.landuse == "residential" || f.place == "neighbourhood" }
        },
        {
            dataLayer: "landuse",
            symbolizer: new PolygonSymbolizer({
                fill:params.hospital,
            }),
            filter:f => { return f.amenity == "hospital" }
        },
        {
            dataLayer: "landuse",
            symbolizer: new PolygonSymbolizer({
                fill:params.cemetery
            }),
            filter:f => { return f.landuse == "cemetery" }
        },
        {
            dataLayer: "landuse",
            symbolizer: new PolygonSymbolizer({
                fill:params.school
            }),
            filter:f => { return f.amenity == "school" || f.amenity == "kindergarten" || f.amenity == "university" || f.amenity == "college" }
        },
        {
            dataLayer: "landuse",
            symbolizer: new PolygonSymbolizer({
                fill:params.industrial
            }),
            filter:f => { return f.landuse == "industrial" }
        },
        {
            dataLayer: "natural",
            symbolizer: new PolygonSymbolizer({
                fill:params.wood
            }),
            filter:f => { return f.natural == "wood" }
        },
        {
            dataLayer: "landuse",
            symbolizer: new PolygonSymbolizer({
                fill:params.grass
            }),
            filter: f => { return f.landuse == "grass" }
        },
        {
            dataLayer: "landuse",
            symbolizer: new PolygonSymbolizer({
                fill:params.park
            }),
            filter: f => { return f.leisure == "park" }
        },
        {
            dataLayer: "water",
            symbolizer: new PolygonSymbolizer({
                fill:params.water
            })
        },
        {
            dataLayer: "natural",
            symbolizer: new PolygonSymbolizer({
                fill:params.sand
            }),
            filter: f => { return f.natural == "sand" }
        },
        {
            dataLayer: "buildings",
            symbolizer: new PolygonSymbolizer({
                fill:params.buildings
            })
        },
        {
            dataLayer: "roads",
            symbolizer: new LineSymbolizer({
                color:params.highwayCasing,
                width: exp(1.4,[[5,1.5],[11,4],[16,9],[20,40]])
            }),
            filter: f => { return f["pmap:kind"] == "highway" }
        },
        {
            dataLayer: "roads",
            symbolizer: new LineSymbolizer({
                color:params.majorRoadCasing,
                width: exp(1.4,[[9,3],[12,4],[17,8],[20,22]])
            }) ,
            filter: f => { return f["pmap:kind"] == "major_road" }
        },
        {
            dataLayer: "roads",
            symbolizer: new LineSymbolizer({
                color:params.mediumRoadCasing,
                width: exp(1.4,[[13,3],[17,6],[20,18]])
            }),
            filter: f => { return f["pmap:kind"] == "medium_road" }
        },
        {
            dataLayer: "roads",
            symbolizer: new LineSymbolizer({
                color:params.minorRoadCasing,
                width: exp(1.4,[[14,2],[17,5],[20,15]])
            }),
            filter: f => { return f["pmap:kind"] == "minor_road" }
        },
        {
            dataLayer: "roads",
            symbolizer: new LineSymbolizer({
                color:params.minorRoad,
                width: exp(1.4,[[14,1],[17,3],[20,13]])
            }),
            filter: f => { return f["pmap:kind"] == "minor_road" }
        },
        {
            dataLayer: "roads",
            symbolizer: new LineSymbolizer({
                color:params.mediumRoad,
                width: exp(1.4,[[13,2],[17,4],[20,15]])
            }),
            filter: f => { return f["pmap:kind"] == "medium_road" }
        },
        {
            dataLayer: "roads",
            symbolizer: new LineSymbolizer({
                color:params.majorRoad,
                width: exp(1.4,[[9,2],[12,3],[17,6],[20,20]])
            }),
            filter: f => { return f["pmap:kind"] == "major_road" }
        },
        {
            dataLayer: "roads",
            symbolizer: new LineSymbolizer({
                color:params.highway,
                width: exp(1.4,[[5,0.5],[11,2.5],[16,7],[20,30]])
            }),
            filter: f => { return f["pmap:kind"] == "highway" }
        },
        {
            dataLayer: "boundaries",
            symbolizer: new LineSymbolizer({
                color:params.boundaries,
                width:2,
                opacity:0.4
            })
        },
        {
            dataLayer: "mask",
            symbolizer: new PolygonSymbolizer({
                fill:params.mask
            })
        }
    ]
}

export const labelRules = (params:DefaultStyleParams) => {
    return [
        {
            dataLayer: "places",
            symbolizer: new CenteredTextSymbolizer({
                fill:params.countryLabel,
                font:(z,p) => {
                    if (z < 6) return "200 14px sans-serif"
                    return "200 20px sans-serif"
                },
                textTransform:"uppercase"
            }),
            filter: f => { return f["pmap:kind"] == "country" }
        },
        {
            dataLayer: "places",
            symbolizer: new CenteredTextSymbolizer({
                fill:params.stateLabel,
                font:"300 16px sans-serif"
            }),
            filter: f => { return f["pmap:kind"] == "state" }
        },
        {
            id:"cities_high",
            dataLayer: "places",
            filter: f => { return f["pmap:kind"] == "city" },
            minzoom:7,
            symbolizer: new CenteredTextSymbolizer({
                fill:params.cityLabel,
                font:(z,p) => {
                    if (p["pmap:rank"] == 1) {
                        if (z > 8) return "600 20px sans-serif"
                        return "600 12px sans-serif"
                    } else {
                        if (z > 8) return "600 16px sans-serif"
                        return "600 10px sans-serif"
                    }
                }
            }),
            sort: (a,b) => { return a["pmap:rank"] - b["pmap:rank"] }
        },
        {
            id:"cities_low",
            dataLayer: "places",
            filter: f => { return f["pmap:kind"] == "city" },
            maxzoom:6,
            symbolizer: new GroupSymbolizer([
                new CircleSymbolizer({
                    radius:2,
                    fill:params.cityLabel
                }),
                new OffsetTextSymbolizer({
                    fill:params.cityLabel,
                    offset:2,
                    font:(z,p) => {
                        if (p["pmap:rank"] == 1) {
                            if (z > 8) return "600 20px sans-serif"
                            return "600 12px sans-serif"
                        } else {
                            if (z > 8) return "600 16px sans-serif"
                            return "600 10px sans-serif"
                        }
                    }
                })
            ]),
            sort: (a,b) => { return a["pmap:rank"] - b["pmap:rank"] }
        },
        {
            dataLayer: "places",
            symbolizer: new CenteredTextSymbolizer({
                fill:params.neighbourhoodLabel,
                font:"500 10px sans-serif",
                textTransform:"uppercase"
            }),
            filter: f => { return f["pmap:kind"] == "neighbourhood" }
        },
        {
            dataLayer: "landuse",
            symbolizer: new PolygonLabelSymbolizer({
                fill:params.landuseLabel,
                font:"300 12px sans-serif"
            })
        },
        {
            dataLayer: "water",
            symbolizer: new PolygonLabelSymbolizer({
                fill:params.waterLabel,
                font:"italic 600 12px sans-serif"
            })
        },
        {
            dataLayer: "natural",
            symbolizer: new PolygonLabelSymbolizer({
                fill:params.naturalLabel,
                font:"italic 300 12px sans-serif"
            })
        },
        {
            dataLayer: "roads",
            symbolizer: new LineLabelSymbolizer({
                fill: params.roadsLabel,
                font:"500 12px sans-serif"
            }),
            minzoom:12
        },
        {
            dataLayer: "roads",
            symbolizer: new ShieldSymbolizer({
                properties:["ref"],
                font:"600 9px sans-serif",
                background:params.highway,
                padding:2,
                fill:"#999"
            }),
            filter: f => { return f["pmap:kind"] == "highway" }
        },
        {
            dataLayer: "pois",
            symbolizer: new GroupSymbolizer([
                new CircleSymbolizer({
                    radius:2,
                    fill:params.poisLabel
                }),
                new OffsetTextSymbolizer({
                    fill:params.poisLabel,
                    offset:2,
                    font:"300 10px sans-serif"
                })
            ]),
        },
    ]
}
