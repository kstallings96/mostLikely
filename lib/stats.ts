/**
 * Exact chances used for the "Lucky win!" badge: given the sentence's
 * spinner, how likely was it to pass this round in one set of spins?
 */

function logFactorial(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

/** P(X = k) for X ~ Binomial(n, p). */
export function binomialPmf(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  const logC = logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** P(X ≥ k) for X ~ Binomial(n, p). */
export function binomialAtLeast(n: number, k: number, p: number): number {
  let s = 0;
  for (let i = Math.max(0, k); i <= n; i++) s += binomialPmf(n, i, p);
  return Math.min(1, s);
}

/**
 * P(both A and B counts land in [lo, hi]) over n spins, where each spin is
 * A with prob pa, B with prob pb, anything else otherwise (multinomial).
 */
export function bothInRange(
  n: number,
  pa: number,
  pb: number,
  lo: number,
  hi: number,
): number {
  const pc = Math.max(0, 1 - pa - pb);
  const lf = (x: number) => logFactorial(x);
  const lp = (p: number, k: number) => (k === 0 ? 0 : p <= 0 ? -Infinity : k * Math.log(p));
  let s = 0;
  for (let a = lo; a <= hi; a++) {
    for (let b = lo; b <= hi && a + b <= n; b++) {
      const c = n - a - b;
      s += Math.exp(lf(n) - lf(a) - lf(b) - lf(c) + lp(pa, a) + lp(pb, b) + lp(pc, c));
    }
  }
  return Math.min(1, s);
}
