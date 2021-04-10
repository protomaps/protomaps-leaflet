import { paintStyle, labelStyle, DefaultStyleParams } from './style'

const light:DefaultStyleParams = {
    earth:"#f6f6f6",
    glacier:"ffffff",
    residential:"#e7e7e7",
    hospital:"#ebebeb",
    cemetery:"#e2e2e2",
    school:"#ececec",
    industrial:"#f2f2f2",
    wood:"#8a8a8a",
    grass:"#e0e0e0",
    park:"#eeeeee",
    water:"#d3d3d3",
    sand:"#ebebeb",
    buildings:"#eeeeee",
    highwayCasing:"#cfcfcf",
    majorRoadCasing:"#cfcfcf",
    mediumRoadCasing:"#cccccc",
    minorRoadCasing:"#cccccc",
    highway:"#e8e8e8",
    majorRoad:"#ececec",
    mediumRoad:"#ececec",
    minorRoad:"#ffffff",
    boundaries:"#9e9e9e",
    mask:"#dddddd",
    countryLabel:"#dddddd",
    cityLabel:"#888888",
    stateLabel:"#cccccc",
    neighbourhoodLabel:"#888888",
    landuseLabel:"#898989",
    waterLabel:"#717171",
    naturalLabel:"4c4c4c",
    roadsLabel:"#888888",
    poisLabel:"#606060"
}

export const paint_style = paintStyle(light)
export const label_style = labelStyle(light)
