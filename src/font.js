// Approximate Bedrock glyph metrics in GUI units, before viewport scaling.
export const FONT_SIZES = Object.freeze({small: 8, normal: 9, large: 12, extra_large: 18});

export function fontMetrics(obj = {}) {
  const named = Object.hasOwn(FONT_SIZES, obj.font_size) ? FONT_SIZES[obj.font_size] : undefined;
  const numeric = Number(obj.font_size);
  const base = named ?? (Number.isFinite(numeric) && numeric > 0 ? numeric : FONT_SIZES.normal);
  const factor = Number(obj.font_scale_factor ?? 1);
  const scale = Number.isFinite(factor) && factor >= 0 ? factor : 1;
  return {fontSize: base * scale, lineHeight: base * scale * 12 / 9};
}
