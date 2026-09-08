/**
 * Shared formatting utilities for visible UI presentation.
 * Standardizes monetary figures to Pakistani Rupees ("Rs. 25,000.00") with en-PK formatting.
 * Does not mutate database values, APIs, or export numbers.
 */

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") {
    return "Rs. 0.00";
  }
  const numeric = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  if (isNaN(numeric)) {
    return "Rs. 0.00";
  }
  return `Rs. ${numeric.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCrates(quantity: number | string | null | undefined): string {
  if (quantity === null || quantity === undefined || quantity === "") {
    return "0";
  }
  const numeric =
    typeof quantity === "string"
      ? parseInt(quantity, 10)
      : Math.round(Number(quantity));
  if (isNaN(numeric)) {
    return "0";
  }
  return numeric.toLocaleString("en-PK");
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
