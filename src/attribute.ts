export class TextSpec {
    properties:string[]
    textTransform:string

    constructor(options:any = {}) {
        this.properties = options.properties || ["name"]
        this.textTransform = options.textTransform
    }

    public str(z:number,f:any):string {
        var retval
        for (let property of this.properties) {
            if (f.hasOwnProperty(property)) {
                retval = f[property]
                break
            }
        } 
        if (retval && this.textTransform === "uppercase") retval = retval.toUpperCase()
        return retval
    }
}

export class FontSpec {
    family?: string | ((z:number,f:any) => string)
    size?: number | ((z:number,f:any) => number)
    weight?: number | ((z:number,f:any) => number)
    style?: number | ((z:number,f:any) => number)
    font?: string | ((z:number,f:any) => string)

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

    public str(z:number,f:string) {
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