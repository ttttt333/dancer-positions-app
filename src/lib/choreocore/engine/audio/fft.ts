/**
 * In-place radix-2 FFT.
 * WHY: band energy / centroid / flux need a magnitude spectrum, and we must
 * stay dependency-free so analysis is deterministic and runs in a Worker.
 */
export function fftRadix2(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || n < 2 || (n & (n - 1)) !== 0) {
    throw new Error("fftRadix2 requires equal power-of-two buffers");
  }

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    while ((j & bit) !== 0) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < half; j += 1) {
        const uRe = re[i + j]!;
        const uIm = im[i + j]!;
        const vr = re[i + j + half]!;
        const vi = im[i + j + half]!;
        const tRe = vr * wRe - vi * wIm;
        const tIm = vr * wIm + vi * wRe;
        re[i + j] = uRe + tRe;
        im[i + j] = uIm + tIm;
        re[i + j + half] = uRe - tRe;
        im[i + j + half] = uIm - tIm;
        const nextRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextRe;
      }
    }
  }
}

export function hannWindow(length: number): Float64Array {
  const w = new Float64Array(length);
  if (length <= 1) {
    if (length === 1) w[0] = 1;
    return w;
  }
  const denom = length - 1;
  for (let i = 0; i < length; i += 1) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom));
  }
  return w;
}
