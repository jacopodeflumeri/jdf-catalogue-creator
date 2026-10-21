import { createCsvRow, escapeCsvValue } from "../csv";

describe("CSV utilities", () => {
  it("escapes RFC 4180 delimiters and quotes", () => {
    expect(createCsvRow(["plain", "comma,value", 'say "hello"'])).toBe(
      'plain,"comma,value","say ""hello"""',
    );
  });

  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)"])(
    "neutralizes spreadsheet formula prefix %s",
    (value) => {
      expect(escapeCsvValue(value)).toBe(`'${value}`);
    },
  );

  it("does not alter formula-like characters away from the start", () => {
    expect(escapeCsvValue("safe=value")).toBe("safe=value");
  });
});
