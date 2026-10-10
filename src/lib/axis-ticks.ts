/**
 * Round axis ticks for a tight-domain chart: whole numbers, then 2s, 5s, 10s as
 * the range grows, with a step of headroom when the data sits on an edge.
 * Recharts' own ticks on a `dataMin - 1` domain landed on values like 76.9
 * and 77.8.
 */
export function roundTicks(values: number[], maxTicks = 5): { domain: [number, number]; ticks: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  for (const step of [1, 2, 5, 10, 20, 50, 100]) {
    let start = Math.floor(lo / step) * step;
    let end = Math.ceil(hi / step) * step;
    if (lo - start < step / 4) start -= step;
    if (end - hi < step / 4) end += step;
    const count = Math.round((end - start) / step) + 1;
    if (count <= maxTicks || step === 100) {
      return {
        domain: [start, end],
        ticks: Array.from({ length: count }, (_, i) => start + i * step),
      };
    }
  }
  // Unreachable: the last step always returns.
  return { domain: [lo, hi], ticks: [lo, hi] };
}
