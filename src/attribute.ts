import { Feature } from "./tilecache";

export type AttrOption<T> = T | ((z: number, f?: Feature) => T);

export class StringAttr<T extends string = string> {
  str: AttrOption<T>;
  per_feature: boolean;

  constructor(c: AttrOption<T> | undefined, defaultValue: T) {
    this.str = c ?? defaultValue;
    this.per_feature = typeof this.str == "function" && this.str.length == 2;
  }

  public get(z: number, f?: Feature): T {
    if (typeof this.str === "function") {
      return this.str(z, f);
    } else {
      return this.str;
    }
  }
}

export class NumberAttr {
  value: AttrOption<number>;
  per_feature: boolean;

  constructor(c: AttrOption<number> | undefined, defaultValue: number = 1) {
    this.value = c ?? defaultValue;
    this.per_feature =
      typeof this.value == "function" && this.value.length == 2;
  }

  public get(z: number, f?: Feature): number {
    if (typeof this.value == "function") {
      return this.value(z, f);
    } else {
      return this.value;
    }
  }
}

export interface TextAttrOptions {
  label_props?: AttrOption<string[]>;
  textTransform?: AttrOption<string>;
}

export class TextAttr {
  label_props: AttrOption<string[]>;
  textTransform?: AttrOption<string>;

  constructor(options?: TextAttrOptions) {
    this.label_props = options?.label_props ?? ["name"];
    this.textTransform = options?.textTransform;
  }

  public get(z: number, f: Feature): string | undefined {
    let retval: string | undefined;

    let label_props: string[];
    if (typeof this.label_props == "function") {
      label_props = this.label_props(z, f);
    } else {
      label_props = this.label_props;
    }
    for (let property of label_props) {
      if (
        f.props.hasOwnProperty(property) &&
        typeof f.props[property] === "string"
      ) {
        retval = f.props[property] as string;
        break;
      }
    }
    let transform;
    if (typeof this.textTransform === "function") {
      transform = this.textTransform(z, f);
    } else {
      transform = this.textTransform;
    }
    if (retval && transform === "uppercase") retval = retval.toUpperCase();
    else if (retval && transform === "lowercase") retval = retval.toLowerCase();
    else if (retval && transform === "capitalize") {
      const wordsArray = retval.toLowerCase().split(" ");
      const capsArray = wordsArray.map((word: string) => {
        return word[0].toUpperCase() + word.slice(1);
      });
      retval = capsArray.join(" ");
    }
    return retval;
  }
}

export interface FontAttrOptions {
  font?: AttrOption<string>;
  fontFamily?: AttrOption<string>;
  fontSize?: AttrOption<number>;
  fontWeight?: AttrOption<number>;
  fontStyle?: AttrOption<string>;
}

export class FontAttr {
  family?: AttrOption<string>;
  size?: AttrOption<number>;
  weight?: AttrOption<number>;
  style?: AttrOption<string>;
  font?: AttrOption<string>;

  constructor(options?: FontAttrOptions) {
    if (options?.font) {
      this.font = options.font;
    } else {
      this.family = options?.fontFamily ?? "sans-serif";
      this.size = options?.fontSize ?? 12;
      this.weight = options?.fontWeight;
      this.style = options?.fontStyle;
    }
  }

  public get(z: number, f?: Feature) {
    if (this.font) {
      if (typeof this.font === "function") {
        return this.font(z, f);
      } else {
        return this.font;
      }
    } else {
      var style = "";
      if (this.style) {
        if (typeof this.style === "function") {
          style = this.style(z, f) + " ";
        } else {
          style = this.style + " ";
        }
      }

      var weight = "";
      if (this.weight) {
        if (typeof this.weight === "function") {
          weight = this.weight(z, f) + " ";
        } else {
          weight = this.weight + " ";
        }
      }

      var size;
      if (typeof this.size === "function") {
        size = this.size(z, f);
      } else {
        size = this.size;
      }

      var family;
      if (typeof this.family === "function") {
        family = this.family(z, f);
      } else {
        family = this.family;
      }

      return `${style}${weight}${size}px ${family}`;
    }
  }
}

export class ArrayAttr<T = number> {
  value: AttrOption<T[]>;
  per_feature: boolean;

  constructor(c: AttrOption<T[]>, defaultValue: T[] = []) {
    this.value = c ?? defaultValue;
    this.per_feature =
      typeof this.value == "function" && this.value.length == 2;
  }

  public get(z: number, f?: Feature): T[] {
    if (typeof this.value == "function") {
      return this.value(z, f);
    } else {
      return this.value;
    }
  }
}
