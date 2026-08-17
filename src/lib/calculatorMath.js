export const CALCULATOR_EXPRESSION_LIMIT = 160;
export const CALCULATOR_HISTORY_LIMIT = 30;

const NUMBER_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i;

function calculatorError(message) {
  return new Error(message);
}

function normalizeExpression(expression) {
  return String(expression ?? "")
    .replace(/[\u00d7xX]/g, "*")
    .replace(/\u00f7/g, "/")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/\s+/g, "");
}

function tokenize(expression) {
  const source = normalizeExpression(expression);

  if (!source) throw calculatorError("Enter a calculation.");
  if (source.length > CALCULATOR_EXPRESSION_LIMIT) {
    throw calculatorError("The calculation is too long.");
  }

  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];

    if ("+-*/()%".includes(character)) {
      tokens.push({ type: character, value: character });
      index += 1;
      continue;
    }

    const numberMatch = source.slice(index).match(NUMBER_PATTERN);
    if (!numberMatch) {
      throw calculatorError(`Unsupported character: ${character}`);
    }

    const numericValue = Number(numberMatch[0]);
    if (!Number.isFinite(numericValue)) {
      throw calculatorError("The number is outside the supported range.");
    }

    tokens.push({ type: "number", value: numericValue });
    index += numberMatch[0].length;
  }

  return tokens;
}

function ensureFinite(value) {
  if (!Number.isFinite(value)) {
    throw calculatorError("The result is outside the supported range.");
  }
  return value;
}

function parseTokens(tokens) {
  let cursor = 0;

  const current = () => tokens[cursor];
  const consume = (type) => {
    if (current()?.type !== type) return false;
    cursor += 1;
    return true;
  };

  function parsePrimary() {
    if (consume("(")) {
      const inner = parseExpression();
      if (!consume(")")) throw calculatorError("A closing parenthesis is missing.");
      return inner;
    }

    const token = current();
    if (token?.type !== "number") {
      throw calculatorError("A number is expected here.");
    }
    cursor += 1;
    return { value: token.value, isPercent: false };
  }

  function parseUnary() {
    if (consume("+")) return parseUnary();
    if (consume("-")) {
      const operand = parseUnary();
      return {
        value: ensureFinite(-operand.value),
        isPercent: operand.isPercent,
      };
    }

    const primary = parsePrimary();
    let value = primary.value;
    let isPercent = primary.isPercent;

    while (consume("%")) {
      value = ensureFinite(value / 100);
      isPercent = true;
    }

    return { value, isPercent };
  }

  function parseTerm() {
    let left = parseUnary();

    while (current()?.type === "*" || current()?.type === "/") {
      const operator = current().type;
      cursor += 1;
      const right = parseUnary();

      if (operator === "/" && right.value === 0) {
        throw calculatorError("Cannot divide by zero.");
      }

      left = {
        value: ensureFinite(
          operator === "*"
            ? left.value * right.value
            : left.value / right.value,
        ),
        isPercent: false,
      };
    }

    return left;
  }

  function parseExpression() {
    let left = parseTerm();

    while (current()?.type === "+" || current()?.type === "-") {
      const operator = current().type;
      cursor += 1;
      const right = parseTerm();
      const rightValue = right.isPercent
        ? left.value * right.value
        : right.value;

      left = {
        value: ensureFinite(
          operator === "+"
            ? left.value + rightValue
            : left.value - rightValue,
        ),
        isPercent: false,
      };
    }

    return left;
  }

  const result = parseExpression();
  if (cursor !== tokens.length) {
    throw calculatorError("Check the calculation and try again.");
  }
  return result.value;
}

export function formatCalculatorNumber(value) {
  const numericValue = Number(value);
  ensureFinite(numericValue);
  if (Object.is(numericValue, -0) || numericValue === 0) return "0";

  // Twelve significant digits keep the display useful while removing the
  // familiar binary floating-point noise from values such as 0.1 + 0.2.
  return Number(numericValue.toPrecision(12)).toString();
}

export function formatCalculatorExpression(expression) {
  return String(expression ?? "")
    .replace(/\*/g, "\u00d7")
    .replace(/\//g, "\u00f7")
    .replace(/-/g, "\u2212");
}

export function evaluateCalculatorExpression(expression) {
  const value = parseTokens(tokenize(expression));
  return {
    value,
    result: formatCalculatorNumber(value),
  };
}

export function normalizeCalculatorHistory(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (entry) =>
        entry &&
        typeof entry.expression === "string" &&
        entry.expression.length <= CALCULATOR_EXPRESSION_LIMIT &&
        typeof entry.result === "string" &&
        entry.result.length <= 40 &&
        Number.isFinite(entry.createdAt),
    )
    .slice(0, CALCULATOR_HISTORY_LIMIT)
    .map((entry) => ({
      expression: entry.expression,
      result: entry.result,
      createdAt: entry.createdAt,
    }));
}
