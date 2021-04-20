import Protosprites from 'protosprites'

// https://github.com/tangrams/tangram/blob/master/src/styles/text/font_manager.js
export const Font = (name,url,weight) => {
    let ff = new FontFace(name,'url(' + url + ')',{weight:weight})
    document.fonts.add(ff)
    return ff.load()
}

// TODO support traditional bitmap spritesheets
export const Sprites = (url) => {
    return new Protosprites(url)
}