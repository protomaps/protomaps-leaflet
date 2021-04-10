import { paintStyle, labelStyle, DefaultStyleParams } from './style'

const dark:DefaultStyleParams = {
    earth:"#151515",
    glacier:"#1c1c1c",
    residential:"#eeeeee",
    hospital:"#111111",
    cemetery:"#eeeeee",
    school:"#eeeeee",
    industrial:"#ffffff",
    wood:"#666666",
    grass:"#ddddddd",
    park:"#999999",
    water:"#111111",
    sand:"#777777",
    buildings:"#333333",
    highwayCasing:"#ffffff",
    majorRoadCasing:"#ffffff",
    mediumRoadCasing:"#cccccc",
    minorRoadCasing:"#cccccc",
    highway:"#000000",
    majorRoad:"#000000",
    mediumRoad:"#000000",
    minorRoad:"#000000",
    boundaries:"#666666",
    mask:"#dddddd",
    countryLabel:"#ffffff",
    cityLabel:"#ffffff",
    stateLabel:"#ffffff",
    neighbourhoodLabel:"#ffffff",
    landuseLabel:"#ffffff",
    waterLabel:"#ffffff",
    naturalLabel:"#ffffff",
    roadsLabel:"#ffffff",
    poisLabel:"#ffffff"
}

export const paint_style = paintStyle(dark)
export const label_style = labelStyle(dark)
