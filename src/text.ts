// TODO should be visual length in pixels, not strlen
export function linebreak(str: string, maxUnits: number): string[] {
  if (str.length <= maxUnits) return [str];
  let endIndex = maxUnits - 1;
  let space_before = str.lastIndexOf(" ", endIndex);
  let space_after = str.indexOf(" ", endIndex);
  if (space_before == -1 && space_after == -1) {
    return [str];
  }
  let first: string;
  let after: string;
  if (
    space_after == -1 ||
    (space_before >= 0 && endIndex - space_before < space_after - endIndex)
  ) {
    first = str.substring(0, space_before);
    after = str.substring(space_before + 1, str.length);
  } else {
    first = str.substring(0, space_after);
    after = str.substring(space_after + 1, str.length);
  }
  return [first, ...linebreak(after, maxUnits)];
}

const CJK_CHARS =
  "\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\u3400-\u4DB5\u4E00-\u9FEA\uF900-\uFA6D\uFA70-\uFAD9\u2000";
const cjk_test = new RegExp("^[" + CJK_CHARS + "]+$");

export function isCjk(s: string) {
  return cjk_test.test(s);
}
