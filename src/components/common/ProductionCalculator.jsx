"use client";

import {
  Calculator,
  Clock3,
  Copy,
  Delete,
  Grip,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  CALCULATOR_EXPRESSION_LIMIT,
  CALCULATOR_HISTORY_LIMIT,
  evaluateCalculatorExpression,
  formatCalculatorExpression,
  normalizeCalculatorHistory,
} from "@/lib/calculatorMath";

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 548;
const MIN_WIDTH = 304;
const MIN_HEIGHT = 500;
const VIEWPORT_MARGIN = 8;
const HEADER_OFFSET = 56;

const operatorLabels = {
  "/": "\u00f7",
  "*": "\u00d7",
  "-": "\u2212",
  "+": "+",
};

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function getInitialGeometry() {
  if (typeof window === "undefined") {
    return {
      x: 16,
      y: HEADER_OFFSET,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };
  }

  const maxWidth = Math.max(260, window.innerWidth - VIEWPORT_MARGIN * 2);
  const maxHeight = Math.max(360, window.innerHeight - HEADER_OFFSET - VIEWPORT_MARGIN);
  const width = Math.min(DEFAULT_WIDTH, maxWidth);
  const height = Math.min(DEFAULT_HEIGHT, maxHeight);

  return {
    x: Math.max(VIEWPORT_MARGIN, window.innerWidth - width - 16),
    y: window.innerHeight - height >= HEADER_OFFSET ? HEADER_OFFSET : VIEWPORT_MARGIN,
    width,
    height,
  };
}

function historyTime(timestamp) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function hasBalancedOpeningParenthesis(expression) {
  let balance = 0;
  for (const character of expression) {
    if (character === "(") balance += 1;
    if (character === ")") balance -= 1;
  }
  return balance > 0;
}

export default function ProductionCalculator({ userId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expression, setExpression] = useState("0");
  const [lastExpression, setLastExpression] = useState("");
  const [error, setError] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadedHistoryKey, setLoadedHistoryKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [geometry, setGeometry] = useState({
    x: 16,
    y: HEADER_OFFSET,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });

  const panelRef = useRef(null);
  const pointerActionRef = useRef(null);
  const historyStorageKey = `kr-production:calculator-history:v1:${String(userId)}`;

  const preview = useMemo(() => {
    if (error) return null;
    try {
      return evaluateCalculatorExpression(expression);
    } catch {
      return null;
    }
  }, [error, expression]);

  const displayExpression = justEvaluated && lastExpression
    ? `${formatCalculatorExpression(lastExpression)} =`
    : formatCalculatorExpression(expression);
  const displayResult = error ? "Cannot calculate" : preview?.result || "\u2014";

  useEffect(() => {
    try {
      const storedHistory = window.localStorage.getItem(historyStorageKey);
      setHistory(storedHistory
        ? normalizeCalculatorHistory(JSON.parse(storedHistory))
        : []);
    } catch {
      // A calculator remains fully usable when browser storage is unavailable.
      setHistory([]);
    } finally {
      setLoadedHistoryKey(historyStorageKey);
    }
  }, [historyStorageKey]);

  useEffect(() => {
    if (loadedHistoryKey !== historyStorageKey) return;
    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
    } catch {
      // Ignore private-mode and storage-quota failures.
    }
  }, [history, historyStorageKey, loadedHistoryKey]);

  useEffect(() => {
    if (!copied) return undefined;
    const timeout = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const focusFrame = window.requestAnimationFrame(() => panelRef.current?.focus());
    const keepInViewport = () => {
      setGeometry((current) => {
        const maxWidth = Math.max(260, window.innerWidth - VIEWPORT_MARGIN * 2);
        const maxHeight = Math.max(360, window.innerHeight - VIEWPORT_MARGIN * 2);
        const width = Math.min(current.width, maxWidth);
        const height = Math.min(current.height, maxHeight);
        return {
          width,
          height,
          x: clamp(current.x, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
          y: clamp(current.y, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
        };
      });
    };

    window.addEventListener("resize", keepInViewport);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("resize", keepInViewport);
    };
  }, [isOpen]);

  const setSafeExpression = useCallback((nextExpression) => {
    if (nextExpression.length > CALCULATOR_EXPRESSION_LIMIT) return;
    setExpression(nextExpression || "0");
    setError("");
  }, []);

  const appendDigit = useCallback((digit) => {
    let next = expression;
    if (justEvaluated || error) {
      next = digit;
      setJustEvaluated(false);
      setLastExpression("");
    } else if (next === "0") {
      next = digit;
    } else if (next === "-0") {
      next = `-${digit}`;
    } else if (/[)%]$/.test(next)) {
      next += `*${digit}`;
    } else {
      next += digit;
    }
    setSafeExpression(next);
  }, [error, expression, justEvaluated, setSafeExpression]);

  const appendDecimal = useCallback(() => {
    let next = expression;
    if (justEvaluated || error) {
      next = "0.";
      setJustEvaluated(false);
      setLastExpression("");
    } else if (/[)%]$/.test(next)) {
      next += "*0.";
    } else {
      const currentNumber = next.split(/[+\-*/()%]/).at(-1) || "";
      if (currentNumber.includes(".")) return;
      next += /\d$/.test(next) ? "." : "0.";
    }
    setSafeExpression(next);
  }, [error, expression, justEvaluated, setSafeExpression]);

  const appendOperator = useCallback((operator) => {
    let next = error ? "0" : expression;

    if (justEvaluated) {
      setJustEvaluated(false);
      setLastExpression("");
    }

    if (/\d$|[)%]$/.test(next)) {
      next += operator;
    } else if (next.endsWith("(") && operator === "-") {
      next += operator;
    } else if (operator === "-" && /[+*/]$/.test(next)) {
      next += operator;
    } else if (/[+\-*/]+$/.test(next)) {
      next = next.replace(/[+\-*/]+$/, operator);
    }

    setSafeExpression(next);
  }, [error, expression, justEvaluated, setSafeExpression]);

  const appendParenthesis = useCallback((parenthesis) => {
    let next = error ? "0" : expression;

    if (parenthesis === "(") {
      if (justEvaluated || next === "0") next = "(";
      else if (/\d$|[)%]$/.test(next)) next += "*(";
      else next += "(";
      setJustEvaluated(false);
      setLastExpression("");
      setSafeExpression(next);
      return;
    }

    if (hasBalancedOpeningParenthesis(next) && /\d$|[)%]$/.test(next)) {
      setSafeExpression(`${next})`);
    }
  }, [error, expression, justEvaluated, setSafeExpression]);

  const applyPercent = useCallback(() => {
    if (!error && /\d$|\)$/.test(expression)) {
      setSafeExpression(`${expression}%`);
      setJustEvaluated(false);
    }
  }, [error, expression, setSafeExpression]);

  const toggleSign = useCallback(() => {
    if (error) {
      setSafeExpression("0");
      return;
    }

    const match = expression.match(/(\d*\.?\d+(?:e[+\-]?\d+)?)(%*)$/i);
    if (!match || match.index === undefined) return;

    const numberStart = match.index;
    const precedingMinus = expression[numberStart - 1] === "-";
    const minusIsUnary = precedingMinus && (
      numberStart - 1 === 0 || /[+\-*/(]/.test(expression[numberStart - 2])
    );
    const next = minusIsUnary
      ? `${expression.slice(0, numberStart - 1)}${expression.slice(numberStart)}`
      : `${expression.slice(0, numberStart)}-${expression.slice(numberStart)}`;

    setSafeExpression(next);
    setJustEvaluated(false);
  }, [error, expression, setSafeExpression]);

  const clearCalculator = useCallback(() => {
    setExpression("0");
    setLastExpression("");
    setError("");
    setJustEvaluated(false);
  }, []);

  const removeLastCharacter = useCallback(() => {
    if (error) {
      clearCalculator();
      return;
    }
    setSafeExpression(expression.length > 1 ? expression.slice(0, -1) : "0");
    setJustEvaluated(false);
    setLastExpression("");
  }, [clearCalculator, error, expression, setSafeExpression]);

  const calculate = useCallback(() => {
    try {
      const calculation = evaluateCalculatorExpression(expression);
      const entry = {
        expression,
        result: calculation.result,
        createdAt: Date.now(),
      };

      setHistory((current) => [
        entry,
        ...current.filter(
          (item) => item.expression !== entry.expression || item.result !== entry.result,
        ),
      ].slice(0, CALCULATOR_HISTORY_LIMIT));
      setLastExpression(expression);
      setExpression(calculation.result);
      setError("");
      setJustEvaluated(true);
    } catch (calculationError) {
      setError(calculationError instanceof Error
        ? calculationError.message
        : "Check the calculation and try again.");
      setJustEvaluated(false);
    }
  }, [expression]);

  const copyResult = useCallback(async () => {
    const value = preview?.result;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [preview]);

  const useHistoryResult = useCallback((entry) => {
    setExpression(entry.result);
    setLastExpression(entry.expression);
    setError("");
    setJustEvaluated(true);
    setShowHistory(false);
    window.requestAnimationFrame(() => panelRef.current?.focus());
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (
      event.target instanceof HTMLButtonElement &&
      (event.key === "Enter" || event.key === " ")
    ) {
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      appendDigit(event.key);
      return;
    }

    if (["+", "-", "*", "/"].includes(event.key)) {
      event.preventDefault();
      appendOperator(event.key);
      return;
    }

    if (event.key === "." || event.key === ",") {
      event.preventDefault();
      appendDecimal();
      return;
    }

    if (event.key === "(" || event.key === ")") {
      event.preventDefault();
      appendParenthesis(event.key);
      return;
    }

    if (event.key === "%") {
      event.preventDefault();
      applyPercent();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      removeLastCharacter();
      return;
    }

    if (event.key === "Delete" || event.key.toLowerCase() === "c") {
      event.preventDefault();
      clearCalculator();
      return;
    }

    if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      calculate();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }, [
    appendDecimal,
    appendDigit,
    appendOperator,
    appendParenthesis,
    applyPercent,
    calculate,
    clearCalculator,
    removeLastCharacter,
  ]);

  const startDragging = useCallback((event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerActionRef.current = {
      type: "drag",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      geometry,
    };
    panelRef.current?.focus();
  }, [geometry]);

  const dragCalculator = useCallback((event) => {
    const action = pointerActionRef.current;
    if (!action || action.type !== "drag" || action.pointerId !== event.pointerId) return;
    const x = action.geometry.x + event.clientX - action.startX;
    const y = action.geometry.y + event.clientY - action.startY;

    setGeometry({
      ...action.geometry,
      x: clamp(x, VIEWPORT_MARGIN, window.innerWidth - action.geometry.width - VIEWPORT_MARGIN),
      y: clamp(y, VIEWPORT_MARGIN, window.innerHeight - action.geometry.height - VIEWPORT_MARGIN),
    });
  }, []);

  const startResizing = useCallback((event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerActionRef.current = {
      type: "resize",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      geometry,
    };
    panelRef.current?.focus();
  }, [geometry]);

  const resizeCalculator = useCallback((event) => {
    const action = pointerActionRef.current;
    if (!action || action.type !== "resize" || action.pointerId !== event.pointerId) return;
    const maximumWidth = window.innerWidth - action.geometry.x - VIEWPORT_MARGIN;
    const maximumHeight = window.innerHeight - action.geometry.y - VIEWPORT_MARGIN;
    const minimumWidth = Math.min(MIN_WIDTH, maximumWidth);
    const minimumHeight = Math.min(MIN_HEIGHT, maximumHeight);

    setGeometry({
      ...action.geometry,
      width: clamp(
        action.geometry.width + event.clientX - action.startX,
        minimumWidth,
        maximumWidth,
      ),
      height: clamp(
        action.geometry.height + event.clientY - action.startY,
        minimumHeight,
        maximumHeight,
      ),
    });
  }, []);

  const finishPointerAction = useCallback((event) => {
    if (pointerActionRef.current?.pointerId !== event.pointerId) return;
    pointerActionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const toggleCalculator = () => {
    if (!isOpen) {
      setGeometry(getInitialGeometry());
      setShowHistory(false);
    }
    setIsOpen((current) => !current);
  };

  const keyButtonClass =
    "h-full min-h-10 rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-blue-500/40";
  const operatorButtonClass =
    "h-full min-h-10 rounded-lg border border-blue-100 bg-blue-50 text-lg font-semibold text-blue-700 transition hover:bg-blue-100 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-blue-500/40";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggleCalculator}
        className="h-8 px-2 text-slate-600 hover:bg-slate-100 hover:text-[#0b2d47]"
        aria-label="Open calculator"
        aria-controls="production-calculator"
        aria-expanded={isOpen}
        title="Calculator"
      >
        <Calculator />
        <span className="hidden xl:inline">Calculator</span>
      </Button>

      {isOpen && (
        <section
          id="production-calculator"
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Production calculator"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="fixed z-[100] flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 shadow-[0_24px_70px_-20px_rgba(15,23,42,0.45)] outline-none animate-in fade-in zoom-in-95 duration-150 print:hidden"
          style={{
            left: geometry.x,
            top: geometry.y,
            width: geometry.width,
            height: geometry.height,
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white">
              <div
                className="flex h-full min-w-0 flex-1 touch-none select-none items-center gap-2.5 px-3.5 active:cursor-grabbing"
                onPointerDown={startDragging}
                onPointerMove={dragCalculator}
                onPointerUp={finishPointerAction}
                onPointerCancel={finishPointerAction}
                title="Drag to move"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                  <Calculator className="size-4" />
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-semibold text-slate-800">Calculator</p>
                  <p className="truncate text-[10px] text-slate-400">Drag to move</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 pr-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowHistory((current) => !current)}
                  className={showHistory
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}
                  aria-label={showHistory ? "Show keypad" : "Show calculation history"}
                  aria-pressed={showHistory}
                  title={showHistory ? "Back to keypad" : "History"}
                >
                  <Clock3 />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-500 hover:bg-red-50 hover:text-red-700"
                  aria-label="Close calculator"
                  title="Close (Esc)"
                >
                  <X />
                </Button>
              </div>
            </div>

            {showHistory ? (
              <div className="flex min-h-0 flex-1 flex-col bg-white">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Recent calculations</h2>
                    <p className="text-[11px] text-slate-400">
                      Saved on this device · latest {CALCULATOR_HISTORY_LIMIT}
                    </p>
                  </div>
                  {history.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setHistory([])}
                      className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Clear calculator history"
                      title="Clear history"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                  {history.length === 0 ? (
                    <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
                      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Clock3 className="size-5" />
                      </span>
                      <p className="text-sm font-medium text-slate-600">No calculations yet</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Completed calculations will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {history.map((entry) => (
                        <button
                          key={`${entry.createdAt}-${entry.expression}-${entry.result}`}
                          type="button"
                          onClick={() => useHistoryResult(entry)}
                          className="group w-full rounded-xl border border-transparent px-3 py-2.5 text-right transition hover:border-blue-100 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                          title="Use this result"
                        >
                          <span className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                            <span>{historyTime(entry.createdAt)}</span>
                            <span className="truncate font-mono">
                              {formatCalculatorExpression(entry.expression)} =
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-lg font-semibold text-slate-700 group-hover:text-blue-700">
                            {entry.result}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col p-3">
                <div className="relative shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
                  <div className="flex min-h-5 items-start justify-between gap-2">
                    <p
                      className="min-w-0 flex-1 truncate text-right font-mono text-xs text-slate-400"
                      title={displayExpression}
                    >
                      {displayExpression}
                    </p>
                    <button
                      type="button"
                      onClick={copyResult}
                      disabled={!preview}
                      className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                      aria-label="Copy calculator result"
                      title="Copy result"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                  <p
                    className={`mt-2 truncate text-right font-mono text-3xl font-semibold tracking-tight ${
                      error ? "text-red-600" : "text-slate-900"
                    }`}
                    aria-live="polite"
                    title={displayResult}
                  >
                    {displayResult}
                  </p>
                  {(error || copied) && (
                    <p className={`mt-1 h-4 truncate text-right text-[10px] ${
                      error ? "text-red-500" : "text-emerald-600"
                    }`} title={error || undefined}>
                      {error || "Result copied"}
                    </p>
                  )}
                </div>

                <div className="mt-3 grid h-10 shrink-0 grid-cols-5 gap-2">
                  <button type="button" onClick={clearCalculator} className={`${keyButtonClass} text-sm text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700`} title="Clear (Delete or C)">
                    AC
                  </button>
                  <button type="button" onClick={() => appendParenthesis("(")} className={keyButtonClass} aria-label="Opening parenthesis" title="Opening parenthesis">
                    (
                  </button>
                  <button type="button" onClick={() => appendParenthesis(")")} className={keyButtonClass} aria-label="Closing parenthesis" title="Closing parenthesis">
                    )
                  </button>
                  <button type="button" onClick={applyPercent} className={keyButtonClass} title="Percent">
                    %
                  </button>
                  <button type="button" onClick={removeLastCharacter} className={keyButtonClass} aria-label="Backspace" title="Backspace">
                    <Delete className="mx-auto size-4.5" />
                  </button>
                </div>

                <div className="mt-2 grid min-h-0 flex-1 grid-cols-4 grid-rows-5 gap-2">
                  {[
                    { digits: ["7", "8", "9"], operator: "/", label: "Divide" },
                    { digits: ["4", "5", "6"], operator: "*", label: "Multiply" },
                    { digits: ["1", "2", "3"], operator: "-", label: "Subtract" },
                  ].flatMap(({ digits, operator, label }) => [
                    ...digits.map((digit) => (
                      <button key={digit} type="button" onClick={() => appendDigit(digit)} className={keyButtonClass}>{digit}</button>
                    )),
                    <button
                      key={`operator-${operator}`}
                      type="button"
                      onClick={() => appendOperator(operator)}
                      className={operatorButtonClass}
                      aria-label={label}
                    >
                      {operatorLabels[operator]}
                    </button>,
                  ])}
                  <button type="button" onClick={toggleSign} className={keyButtonClass} aria-label="Toggle positive or negative">
                    <span className="text-sm">+/−</span>
                  </button>
                  <button type="button" onClick={() => appendDigit("0")} className={keyButtonClass}>0</button>
                  <button type="button" onClick={appendDecimal} className={keyButtonClass} aria-label="Decimal point">.</button>
                  <button type="button" onClick={() => appendOperator("+")} className={operatorButtonClass} aria-label="Add">
                    {operatorLabels["+"]}
                  </button>
                  <button
                    type="button"
                    onClick={calculate}
                    className="col-span-4 h-full min-h-10 rounded-lg bg-blue-600 text-xl font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2"
                    aria-label="Calculate"
                  >
                    =
                  </button>
                </div>

              </div>
            )}
          </div>

          <div
            className="absolute bottom-0 right-0 flex size-5 touch-none select-none cursor-se-resize items-end justify-end p-0.5 text-slate-300 transition hover:text-blue-500"
            onPointerDown={startResizing}
            onPointerMove={resizeCalculator}
            onPointerUp={finishPointerAction}
            onPointerCancel={finishPointerAction}
            role="separator"
            aria-label="Resize calculator"
            title="Drag to resize"
          >
            <Grip className="size-3.5 rotate-45" />
          </div>
        </section>
      )}
    </>
  );
}
