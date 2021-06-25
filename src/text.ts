// TODO should be visual length in pixels, not strlen
export function linebreak(str:string):string[] {
    if (str.length <= 15) return [str]
    let space_before = str.lastIndexOf(" ",14)
    let space_after = str.indexOf(" ",14)
    if(space_before == -1 && space_after == -1) {
        return [str]
    }
    let first:string
    let after:string
    if (space_after == -1 || 14 - space_before < space_after - 14) {
        first = str.substring(0,space_before)
        after = str.substring(space_before+1,str.length)
    } else {
        first = str.substring(0,space_after)
        after = str.substring(space_after+1,str.length)
    }
    return [first,...linebreak(after)]
}

const CJK_CHARS = '\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\u3400-\u4DB5\u4E00-\u9FEA\uF900-\uFA6D\uFA70-\uFAD9\u2000';
const cjk_test = new RegExp('^['+CJK_CHARS+']+$');

export function isCjk(s) {
    return cjk_test.test(s)
}

export class TextSpec {
    properties:string[]
    textTransform:string

    constructor(options:any = {}) {
        this.properties = options.properties || ["name"]
        this.textTransform = options.textTransform
    }

    public str(z,f) {
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
    family: string | ((z:number,f:any) => string)
    size: number | ((z:number,f:any) => number)
    weight: number | ((z:number,f:any) => number)
    style: number | ((z:number,f:any) => number)
    font: string | ((z:number,f:any) => string)

    constructor(options) {
        if (options.font) {
            this.font = options.font
        } else {
            this.family = options.fontFamily || 'sans-serif'
            this.size = options.fontSize || 12
            this.weight = options.fontWeight
            this.style = options.fontStyle
        }
    }

    public str(z,f) {
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