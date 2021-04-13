import { paintStyle, labelStyle, DefaultStyleParams } from './style'

const light:DefaultStyleParams = {
    earth:"#FFFBF6",
    glacier:"#ffffff",
    residential:"#e7e7e7",
    hospital:"#FFF6F6",
    cemetery:"#EFF2EE",
    school:"#F7F6FF",
    industrial:"#FFF9EF",
    wood:"#F4F9EF",
    grass:"#EBF9E3",
    park:"#E5F9D5",
    water:"#B7DFF2",
    sand:"#ebebeb",
    buildings:"#F2EDE8",
    highwayCasing:"#FFC3C3",
    majorRoadCasing:"#FFB9B9",
    mediumRoadCasing:"#FFCE8E",
    minorRoadCasing:"#cccccc",
    highway:"#FFCEBB",
    majorRoad:"#FFE4B3",
    mediumRoad:"#FFF2C8",
    minorRoad:"#ffffff",
    boundaries:"#9e9e9e",
    mask:"#dddddd",
    countryLabel:"#dddddd",
    cityLabel:"#6C6C6C",
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
