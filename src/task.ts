declare var document: any
declare var FontFace: any

// @ts-ignore
import Protosprites from 'protosprites'

// https://github.com/tangrams/tangram/blob/master/src/styles/text/font_manager.js
export const Font = (name:string,url:string,weight:number) => {
    let ff = new FontFace(name,'url(' + url + ')',{weight:weight})
    document.fonts.add(ff)
    return ff.load()
}

// TODO support traditional bitmap spritesheets
export const Sprites = (url:string) => {
    return new Protosprites(url)
}