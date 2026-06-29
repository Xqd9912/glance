export interface OklchColor {
  chroma: number;
  hue: number;
  lightness: number;
}

interface OklabColor {
  a: number;
  b: number;
  lightness: number;
}

const COLOR_DISTANCE_LIGHTNESS_WEIGHT = 0.65;
const COLOR_DISTANCE_CHROMA_WEIGHT = 1.2;
const COLOR_DISTANCE_HUE_WEIGHT = 2.0;

export function hexToOklch(hex: string): OklchColor {
  const lab = hexToOklab(hex);
  return {
    chroma: Math.hypot(lab.a, lab.b),
    hue: (Math.atan2(lab.b, lab.a) * 180) / Math.PI,
    lightness: lab.lightness,
  };
}

export function oklchDistance(left: OklchColor, right: OklchColor): number {
  const lightnessDistance =
    COLOR_DISTANCE_LIGHTNESS_WEIGHT * (left.lightness - right.lightness);
  const chromaDistance = COLOR_DISTANCE_CHROMA_WEIGHT * (left.chroma - right.chroma);
  const hueArcDistance =
    COLOR_DISTANCE_HUE_WEIGHT *
    ((left.chroma + right.chroma) / 2) *
    hueDistanceRadians(left.hue, right.hue);
  return Math.hypot(lightnessDistance, chromaDistance, hueArcDistance);
}

export function oklchToInGamutHex(color: OklchColor): string {
  if (inGamut(oklchToLinearSrgb(color))) {
    return linearSrgbToHex(oklchToLinearSrgb(color));
  }

  let low = 0;
  let high = color.chroma;
  for (let index = 0; index < 28; index += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToLinearSrgb({ ...color, chroma: mid }))) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return linearSrgbToHex(oklchToLinearSrgb({ ...color, chroma: low }));
}

function hexToOklab(hex: string): OklabColor {
  const [red, green, blue] = hexToLinearSrgb(hex);
  const long = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const medium = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const short = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;

  const longRoot = Math.cbrt(long);
  const mediumRoot = Math.cbrt(medium);
  const shortRoot = Math.cbrt(short);

  return {
    lightness:
      0.2104542553 * longRoot + 0.793617785 * mediumRoot - 0.0040720468 * shortRoot,
    a: 1.9779984951 * longRoot - 2.428592205 * mediumRoot + 0.4505937099 * shortRoot,
    b: 0.0259040371 * longRoot + 0.7827717662 * mediumRoot - 0.808675766 * shortRoot,
  };
}

function hueDistanceRadians(left: number, right: number): number {
  const degrees = Math.abs(((left - right + 180) % 360) - 180);
  return (degrees * Math.PI) / 180;
}

function oklchToLinearSrgb({ chroma, hue, lightness }: OklchColor): [number, number, number] {
  const hueRadians = (hue * Math.PI) / 180;
  const labA = chroma * Math.cos(hueRadians);
  const labB = chroma * Math.sin(hueRadians);

  const longRoot = lightness + 0.3963377774 * labA + 0.2158037573 * labB;
  const mediumRoot = lightness - 0.1055613458 * labA - 0.0638541728 * labB;
  const shortRoot = lightness - 0.0894841775 * labA - 1.291485548 * labB;

  const long = longRoot ** 3;
  const medium = mediumRoot ** 3;
  const short = shortRoot ** 3;

  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

function hexToSrgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function hexToLinearSrgb(hex: string): [number, number, number] {
  const [red, green, blue] = hexToSrgb(hex);
  return [
    srgbChannelToLinear(red),
    srgbChannelToLinear(green),
    srgbChannelToLinear(blue),
  ];
}

function srgbChannelToLinear(value: number): number {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return ((value + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(value: number): number {
  if (value <= 0.0031308) {
    return 12.92 * value;
  }
  return 1.055 * value ** (1 / 2.4) - 0.055;
}

function linearSrgbToHex([red, green, blue]: [number, number, number]): string {
  const rgb = [red, green, blue]
    .map((channel) => linearChannelToSrgb(clamp(channel, 0, 1)))
    .map((channel) => Math.round(clamp(channel, 0, 1) * 255));
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function inGamut(rgb: readonly number[]): boolean {
  return rgb.every((channel) => channel >= -1e-9 && channel <= 1 + 1e-9);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
