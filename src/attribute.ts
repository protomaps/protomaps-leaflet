import { Feature } from "./tilecache";

export type AttrOption<T> = T | ((z: number, f?: Feature) => T);

export class StringAttr<T extends string = string> {
  str: AttrOption<T>;
  perFeature: boolean;

  constructor(c: AttrOption<T> | undefined, defaultValue: T) {
    this.str = c ?? defaultValue;
    this.perFeature = typeof this.str === "function" && this.str.length === 2;
  }

  public get(z: number, f?: Feature): T {
    if (typeof this.str === "function") {
      return this.str(z, f);
    }
    return this.str;
  }
}

export class NumberAttr {
  value: AttrOption<number>;
  perFeature: boolean;

  constructor(c: AttrOption<number> | undefined, defaultValue = 1) {
    this.value = c ?? defaultValue;
    this.perFeature =
      typeof this.value === "function" && this.value.length === 2;
  }

  public get(z: number, f?: Feature): number {
    if (typeof this.value === "function") {
      return this.value(z, f);
    }
    return this.value;
  }
}

export interface TextAttrOptions {
  labelProps?: AttrOption<string[]>;
  textTransform?: AttrOption<string>;
}

export class TextAttr {
  labelProps: AttrOption<string[]>;
  textTransform?: AttrOption<string>;

  constructor(options?: TextAttrOptions) {
    this.labelProps = options?.labelProps ?? ["name"];
    this.textTransform = options?.textTransform;
  }

  public get(z: number, f: Feature): string | undefined {
    let retval: string | undefined;

    let labelProps: string[];
    if (typeof this.labelProps === "function") {
      labelProps = this.labelProps(z, f);
    } else {
      labelProps = this.labelProps;
    }
    for (const property of labelProps) {
      if (
        Object.prototype.hasOwnProperty.call(f.props, property) &&
        typeof f.props[property] === "string"
      ) {
        retval = f.props[property] as string;
        break;
      }
    }
    let transform: string | ((z: number, f: Feature) => string) | undefined;
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
      }
      return this.font;
    }
    let style = "";
    if (this.style) {
      if (typeof this.style === "function") {
        style = `${this.style(z, f)} `;
      } else {
        style = `${this.style} `;
      }
    }

    let weight = "";
    if (this.weight) {
      if (typeof this.weight === "function") {
        weight = `${this.weight(z, f)} `;
      } else {
        weight = `${this.weight} `;
      }
    }

    let size: number | ((z: number, f: Feature) => number) | undefined;
    if (typeof this.size === "function") {
      size = this.size(z, f);
    } else {
      size = this.size;
    }

    let family: string | ((z: number, f: Feature) => string) | undefined;
    if (typeof this.family === "function") {
      family = this.family(z, f);
    } else {
      family = this.family;
    }

    return `${style}${weight}${size}px ${family}`;
  }
}

export class ArrayAttr<T = number> {
  value: AttrOption<T[]>;
  perFeature: boolean;

  constructor(c: AttrOption<T[]>, defaultValue: T[] = []) {
    this.value = c ?? defaultValue;
    this.perFeature =
      typeof this.value === "function" && this.value.length === 2;
  }

  public get(z: number, f?: Feature): T[] {
    if (typeof this.value === "function") {
      return this.value(z, f);
    }
    return this.value;
  }
}
