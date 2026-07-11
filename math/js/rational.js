// rational.js — exact rational arithmetic.
// Values in the chain engine are Rationals so that fraction/decimal comparisons
// and division-by rules are exact (no floating point error).

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

export class Rational {
  /** @param {number} num @param {number} den (integers) */
  constructor(num, den = 1) {
    if (den === 0) throw new Error('Rational: division by zero');
    if (!Number.isInteger(num) || !Number.isInteger(den)) {
      throw new Error(`Rational expects integers, got ${num}/${den}`);
    }
    if (den < 0) {
      num = -num;
      den = -den;
    }
    const g = gcd(num, den) || 1;
    this.n = num / g;
    this.d = den / g;
  }

  static from(value) {
    if (value instanceof Rational) return value;
    if (Number.isInteger(value)) return new Rational(value, 1);
    throw new Error(`Rational.from needs an integer or Rational, got ${value}`);
  }

  static int(n) {
    return new Rational(n, 1);
  }

  add(o) {
    o = Rational.from(o);
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o) {
    o = Rational.from(o);
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o) {
    o = Rational.from(o);
    return new Rational(this.n * o.n, this.d * o.d);
  }
  div(o) {
    o = Rational.from(o);
    if (o.n === 0) throw new Error('Rational: division by zero');
    return new Rational(this.n * o.d, this.d * o.n);
  }
  neg() {
    return new Rational(-this.n, this.d);
  }

  isInteger() {
    return this.d === 1;
  }
  /** True if this rational can be written as a terminating decimal (den = 2^a·5^b). */
  isTerminatingDecimal() {
    let d = this.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    return d === 1;
  }
  /**
   * Number of decimal places needed for an exact terminating expansion, or
   * Infinity if the value doesn't terminate. E.g. 1/2 → 1, 3/4 → 2, 1/8 → 3.
   */
  decimalPlaces() {
    if (!this.isTerminatingDecimal()) return Infinity;
    let d = this.d;
    let twos = 0;
    let fives = 0;
    while (d % 2 === 0) {
      d /= 2;
      twos++;
    }
    while (d % 5 === 0) {
      d /= 5;
      fives++;
    }
    return Math.max(twos, fives);
  }
  toNumber() {
    return this.n / this.d;
  }
  abs() {
    return new Rational(Math.abs(this.n), this.d);
  }
  cmp(o) {
    o = Rational.from(o);
    return this.n * o.d - o.n * this.d; // sign only; magnitude not meaningful
  }
  equals(o) {
    o = Rational.from(o);
    return this.n === o.n && this.d === o.d;
  }
  lte(o) {
    return this.cmp(o) <= 0;
  }
  gte(o) {
    return this.cmp(o) >= 0;
  }

  /** "N A/B" for mixed, "A/B" for pure fraction, "N" for integers. */
  toMixedString() {
    if (this.d === 1) return String(this.n);
    const sign = this.n < 0 ? '-' : '';
    const an = Math.abs(this.n);
    const whole = Math.floor(an / this.d);
    const rem = an - whole * this.d;
    if (whole === 0) return `${sign}${rem}/${this.d}`;
    return `${sign}${whole} ${rem}/${this.d}`;
  }

  /** Exact decimal string (only meaningful when isTerminatingDecimal()). */
  toDecimalString() {
    const places = this.decimalPlaces();
    if (places === 0) return String(this.n / this.d);
    if (!Number.isFinite(places)) {
      // non-terminating fallback: not exact, but shouldn't be reached for decimal rows
      return (this.n / this.d).toString();
    }
    // Scale to an integer, then place the decimal point by hand — exact, no float.
    const scaled = Math.round((this.n / this.d) * Math.pow(10, places));
    const sign = scaled < 0 ? '-' : '';
    const digits = String(Math.abs(scaled)).padStart(places + 1, '0');
    const intPart = digits.slice(0, digits.length - places);
    const fracPart = digits.slice(digits.length - places);
    return `${sign}${intPart}.${fracPart}`;
  }
}
