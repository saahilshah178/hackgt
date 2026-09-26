/** mapper.number_line: fraction off > tolerance → over ("past") / under ("short of"). */
import { CORRECT, field, miss, num, type ModeDiagnoser } from "./shared";

export function lineFraction(view: unknown, value: number): number {
  const min = num(view, "min") ?? NaN;
  const max = num(view, "max") ?? NaN;
  if (field(view, "scale") === "log") return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return (value - min) / (max - min);
}

export const numberLineDiagnoser: ModeDiagnoser = {
  modeKey: "mapper.number_line",
  failKeys: ["over", "under"],
  mirror({ view, solution, input }) {
    const value = num(input, "value") ?? NaN;
    const target = num(solution, "fraction") ?? NaN;
    const tol = num(solution, "tolerance") ?? 0;
    const got = lineFraction(view, value);
    const off = got - target;
    if (Number.isFinite(got) && Math.abs(off) <= tol) return CORRECT;
    return off > 0 ? miss("over", "past") : miss("under", "short of");
  },
};
