import potpack from "potpack";

// https://github.com/tangrams/tangram/blob/master/src/styles/text/font_manager.js
export const Font = (name: string, url: string, weight: string) => {
  let ff = new FontFace(name, "url(" + url + ")", { weight: weight });
  document.fonts.add(ff);
  return ff.load();
};

interface Sprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PotPackInput {
  x?: number;
  y?: number;
  w: number;
  h: number;
  id: string;
  img: HTMLImageElement;
}

let mkimg = async (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    let img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject("Invalid SVG");
    img.src = src;
  });
};

const MISSING = `
<svg width="20px" height="20px" viewBox="0 0 50 50" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <rect width="50" height="50" fill="#cccccc"/>
    <g transform="translate(5,5)">
        <path fill="none" stroke="#666666" stroke-width="7" d="m11,12a8.5,8 0 1,1 17,0q0,4-4,6t-4.5,4.5-.4,4v.2m0,3v7"/>
    </g>
</svg>
`;

// TODO support traditional bitmap spritesheets
export class Sheet {
  src: string;
  canvas: HTMLCanvasElement;
  mapping: Map<string, Sprite>;
  missingBox: Sprite;

  constructor(src: string) {
    this.src = src;
    this.canvas = document.createElement("canvas");
    this.mapping = new Map<string, Sprite>();
    this.missingBox = { x: 0, y: 0, w: 0, h: 0 };
  }

  async load() {
    let src = this.src;
    let scale = window.devicePixelRatio;
    if (src.endsWith(".html")) {
      let c = await fetch(src);
      src = await c.text();
    }
    let tree = new window.DOMParser().parseFromString(src, "text/html");
    let icons = Array.from(tree.body.children);

    let missingImg = await mkimg("data:image/svg+xml;base64," + btoa(MISSING));

    let boxes: PotPackInput[] = [
      {
        w: missingImg.width * scale,
        h: missingImg.height * scale,
        img: missingImg,
        id: "",
      },
    ];

    let serializer = new XMLSerializer();
    for (let ps of icons) {
      var svg64 = btoa(serializer.serializeToString(ps));
      var image64 = "data:image/svg+xml;base64," + svg64;
      let img = await mkimg(image64);
      boxes.push({
        w: img.width * scale,
        h: img.height * scale,
        img: img,
        id: ps.id,
      });
    }

    let packresult = potpack(boxes);
    this.canvas.width = packresult.w;
    this.canvas.height = packresult.h;
    let ctx = this.canvas.getContext("2d");
    if (ctx) {
      for (let box of boxes) {
        if (box.x !== undefined && box.y !== undefined) {
          ctx.drawImage(box.img, box.x, box.y, box.w, box.h);
          if (box.id)
            this.mapping.set(box.id, {
              x: box.x,
              y: box.y,
              w: box.w,
              h: box.h,
            });
          else this.missingBox = { x: box.x, y: box.y, w: box.w, h: box.h };
        }
      }
    }
    return this;
  }

  get(name: string): Sprite {
    let result = this.mapping.get(name);
    if (!result) result = this.missingBox;
    return result;
  }
}
