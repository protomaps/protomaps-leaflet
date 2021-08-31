import { Feature } from './tilecache'

export class TextAttr {
    properties:string[]
    textTransform:string

    constructor(options:any = {}) {
        this.properties = options.properties || ["name"]
        this.textTransform = options.textTransform
    }

    public get(z:number,f:Feature):string {
        var retval
        for (let property of this.properties) {
            if (f.props.hasOwnProperty(property)) {
                retval = f.props[property]
                break
            }
        } 
        if (retval && this.textTransform === "uppercase") retval = retval.toUpperCase()
        return retval
    }
}

export class FontAttr {
    family?: string | ((z:number,f:Feature) => string)
    size?: number | ((z:number,f:Feature) => number)
    weight?: number | ((z:number,f:Feature) => number)
    style?: number | ((z:number,f:Feature) => number)
    font?: string | ((z:number,f:Feature) => string)

    constructor(options:any) {
        if (options.font) {
            this.font = options.font
        } else {
            this.family = options.fontFamily || 'sans-serif'
            this.size = options.fontSize || 12
            this.weight = options.fontWeight
            this.style = options.fontStyle
        }
    }

    public get(z:number,f:Feature) {
        if (this.font) {
            if (typeof this.font === 'function') {
                return this.font(z,f)
            } else {
                return this.font
            }
        } else {
            var style = ""
            if (this.style) {
                if (typeof this.style === 'function') {
                   style = this.style(z,f) + " " 
                } else {
                    style = this.style + " "
                }
            }

            var weight = ""
            if (this.weight) {
                if (typeof this.weight === 'function')  {
                    weight = this.weight(z,f) + " "
                } else {
                    weight = this.weight + " "
                }
            }

            var size
            if (typeof this.size === 'function') {
                size = this.size(z,f)
            } else {
                size = this.size
            }

            var family
            if (typeof this.family === 'function') {
                family = this.family(z,f)
            } else {
                family = this.family
            }

            return `${style}${weight}${size}px ${family}`
        }
    }
}