export function linebreak(str:string,maxlen:number):string[] {
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
    return [first,...linebreak(after,maxlen)]
}

const CJK_CHARS = '\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\u3400-\u4DB5\u4E00-\u9FEA\uF900-\uFA6D\uFA70-\uFAD9\u2000';
const cjk_test = new RegExp('^['+CJK_CHARS+']+$');

export function isCjk(s) {
    return cjk_test.test(s)
}

function isFunction(obj) {
  return !!(obj && obj.constructor && obj.call && obj.apply);
}

export class TextSpec {
    constructor(options = {}) {
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
        if (this.textTransform === "uppercase") retval = retval.toUpperCase()
        return retval
    }
}

export class FontSpec {
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
            if (isFunction(this.font)) return this.font(z,f)
            return this.font
        } else {
            var style = ""
            if (this.style) {
                if (isFunction(this.style)) style = this.style(z,f) + " "
                else style = this.style + " "
            }

            var weight = ""
            if (this.weight) {
                if (isFunction(this.weight)) weight = this.weight(z,f) + " "
                else weight = this.weight + " "
            }

            var size = this.size
            if (isFunction(this.size)) {
                size = this.size(z,f)
            }

            var family = this.family
            if (isFunction(this.family)) {
                family = this.family(z,f)
            }

            return `${style}${weight}${size}px ${family}`
        }
    }
}