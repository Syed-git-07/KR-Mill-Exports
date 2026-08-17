import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/lib/calculatorMath.js", import.meta.url),
  "utf8",
);
const calculator = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

test("calculator respects arithmetic precedence and parentheses", () => {
  assert.equal(calculator.evaluateCalculatorExpression("2 + 3 * 4").result, "14");
  assert.equal(calculator.evaluateCalculatorExpression("(2 + 3) * 4").result, "20");
});

test("calculator removes common floating-point display noise", () => {
  assert.equal(calculator.evaluateCalculatorExpression("0.1 + 0.2").result, "0.3");
});

test("calculator percentage follows familiar calculator behavior", () => {
  assert.equal(calculator.evaluateCalculatorExpression("200 + 10%").result, "220");
  assert.equal(calculator.evaluateCalculatorExpression("200 - 10%").result, "180");
  assert.equal(calculator.evaluateCalculatorExpression("200 * 10%").result, "20");
});

test("calculator supports unary signs and repeated percentages", () => {
  assert.equal(calculator.evaluateCalculatorExpression("-5 * -2").result, "10");
  assert.equal(calculator.evaluateCalculatorExpression("50%%").result, "0.005");
});

test("calculator rejects unsafe or invalid expressions", () => {
  assert.throws(
    () => calculator.evaluateCalculatorExpression("1 / 0"),
    /divide by zero/i,
  );
  assert.throws(
    () => calculator.evaluateCalculatorExpression("globalThis.process"),
    /unsupported character/i,
  );
  assert.throws(
    () => calculator.evaluateCalculatorExpression("2 +"),
    /number is expected/i,
  );
});

test("calculator history is validated and bounded", () => {
  const entries = Array.from({ length: 40 }, (_, index) => ({
    expression: `${index} + 1`,
    result: String(index + 1),
    createdAt: index + 1,
  }));
  entries.splice(2, 0, { expression: null, result: "bad", createdAt: 1 });

  const normalized = calculator.normalizeCalculatorHistory(entries);
  assert.equal(normalized.length, calculator.CALCULATOR_HISTORY_LIMIT);
  assert.equal(normalized[0].expression, "0 + 1");
  assert.equal(normalized.at(-1).expression, "29 + 1");
});
