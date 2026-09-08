"use client";

import React, { useState } from "react";

interface CrateStepperProps {
  value?: number;
  defaultValue?: number;
  onChange?: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  name?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
  isError?: boolean;
}

export function CrateStepper({
  value: controlledValue,
  defaultValue = 1,
  onChange,
  min = 1,
  max,
  step = 1,
  disabled = false,
  name,
  id,
  ariaLabel = "Crate quantity",
  className = "",
  isError = false,
}: CrateStepperProps) {
  const [internalVal, setInternalVal] = useState<number>(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalVal;

  const updateValue = (nextVal: number) => {
    if (!isControlled) {
      setInternalVal(nextVal);
    }
    onChange?.(nextVal);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const next = (currentValue || 0) - step;
    if (min !== undefined && next < min) return;
    updateValue(next);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const next = (currentValue || 0) + step;
    if (max !== undefined && next > max) return;
    updateValue(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      updateValue(min !== undefined ? min : 0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;

    let bounded = parsed;
    if (min !== undefined && bounded < min) bounded = min;
    if (max !== undefined && bounded > max) bounded = max;
    updateValue(bounded);
  };

  const isMin = min !== undefined && currentValue <= min;
  const isMax = max !== undefined && currentValue >= max;

  return (
    <div className={`inline-flex items-stretch rounded-lg shadow-2xs ${className}`}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || isMin}
        aria-label={`Decrease ${ariaLabel}`}
        tabIndex={-1}
        className={`w-10 h-10 flex items-center justify-center rounded-l-lg border text-base font-bold select-none transition-colors ${
          disabled || isMin
            ? "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            : "border-zinc-300 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer active:bg-zinc-300 dark:active:bg-zinc-600"
        } ${isError ? "border-red-500" : ""}`}
      >
        −
      </button>
      <input
        type="number"
        id={id}
        name={name}
        value={isNaN(currentValue) ? "" : currentValue}
        onChange={handleInputChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`w-16 h-10 text-center font-bold text-base border-y bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
          isError
            ? "border-red-500 ring-1 ring-red-500"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || isMax}
        aria-label={`Increase ${ariaLabel}`}
        tabIndex={-1}
        className={`w-10 h-10 flex items-center justify-center rounded-r-lg border text-base font-bold select-none transition-colors ${
          disabled || isMax
            ? "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            : "border-zinc-300 dark:border-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer active:bg-zinc-300 dark:active:bg-zinc-600"
        } ${isError ? "border-red-500" : ""}`}
      >
        +
      </button>
    </div>
  );
}
