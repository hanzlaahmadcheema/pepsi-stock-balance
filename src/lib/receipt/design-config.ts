/**
 * Receipt Design Configuration Models & Defaults
 *
 * Defines modular sections, typography, and layout preferences
 * for the 80mm SpeedX thermal receipt printer.
 */

export type ReceiptSectionId =
  | "header"
  | "invoiceMeta"
  | "customer"
  | "itemsTable"
  | "totals"
  | "customerLedger"
  | "containers"
  | "footer";

export interface HeaderSectionConfig {
  show: boolean;
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  taxNumber: string;
  alignment: "center" | "left";
}

export interface InvoiceMetaSectionConfig {
  show: boolean;
  title: string;
  showInvoiceNo: boolean;
  showDate: boolean;
  showCashier: boolean;
  showSaleType: boolean;
}

export interface CustomerSectionConfig {
  show: boolean;
  showCustomerName: boolean;
  showPhone: boolean;
  showAddress: boolean;
  walkInLabel: string;
}

export interface ItemsTableSectionConfig {
  show: boolean;
  showItemName: boolean;
  showQty: boolean;
  showRate: boolean;
  showAmount: boolean;
  itemDivider: "dashed" | "dotted" | "solid" | "none";
  rowSpacing: "compact" | "normal";
}

export interface TotalsSectionConfig {
  show: boolean;
  showSubtotal: boolean;
  showDiscount: boolean;
  showPaid: boolean;
  showCredit: boolean;
  showPaymentMethod: boolean;
  totalLabel: string;
  paidLabel: string;
  creditLabel: string;
  balancePaidFullLabel: string;
}

export interface CustomerLedgerSectionConfig {
  show: boolean;
  label: string;
  showOnlyIfBalance: boolean;
}

export interface ContainersSectionConfig {
  show: boolean;
  title: string;
  plasticLabel: string;
  glassLabel: string;
}

export interface FooterSectionConfig {
  show: boolean;
  thankYouNote: string;
  policyNote: string;
  showBarcodeRef: boolean;
}

export interface ReceiptTypographyConfig {
  fontFamily: "sans" | "mono";
  baseFontSize: "small" | "medium" | "large";
  printableWidth: "72mm" | "76mm" | "80mm";
  dividerStyle: "dashed" | "solid" | "double";
}

export interface ReceiptDesignConfig {
  version: number;
  sectionOrder: ReceiptSectionId[];
  header: HeaderSectionConfig;
  invoiceMeta: InvoiceMetaSectionConfig;
  customer: CustomerSectionConfig;
  itemsTable: ItemsTableSectionConfig;
  totals: TotalsSectionConfig;
  customerLedger: CustomerLedgerSectionConfig;
  containers: ContainersSectionConfig;
  footer: FooterSectionConfig;
  styling: ReceiptTypographyConfig;
}

export const ALL_SECTION_IDS: ReceiptSectionId[] = [
  "header",
  "invoiceMeta",
  "customer",
  "itemsTable",
  "totals",
  "customerLedger",
  "containers",
  "footer",
];

export const SECTION_METADATA: Record<
  ReceiptSectionId,
  { label: string; description: string; canHide: boolean }
> = {
  header: {
    label: "Header & Business Info",
    description: "Depot name, tagline, branch address, phone and alignment",
    canHide: true,
  },
  invoiceMeta: {
    label: "Invoice Identification",
    description: "Title, invoice number, date/time, cashier, and sale type",
    canHide: true,
  },
  customer: {
    label: "Customer Account",
    description: "Customer name, phone number, address, and walk-in fallback",
    canHide: true,
  },
  itemsTable: {
    label: "Items Table",
    description: "Column headers, unit rates, quantities, amounts, and row spacing",
    canHide: false,
  },
  totals: {
    label: "Financial Totals & Balance",
    description: "Subtotal, discount, grand total, paid amount, and payment method",
    canHide: false,
  },
  customerLedger: {
    label: "Customer Ledger Balance",
    description: "Previous due balance from the customer ledger account",
    canHide: true,
  },
  containers: {
    label: "Empty Container Returns",
    description: "Plastic crates and glass bottles return counts",
    canHide: true,
  },
  footer: {
    label: "Footer Notes & Policy",
    description: "Gratitude note, return terms policy, and barcode reference",
    canHide: true,
  },
};

export const DEFAULT_RECEIPT_CONFIG: ReceiptDesignConfig = {
  version: 1,
  sectionOrder: [
    "header",
    "invoiceMeta",
    "customer",
    "itemsTable",
    "totals",
    "customerLedger",
    "containers",
    "footer",
  ],
  header: {
    show: true,
    businessName: "PEPSI REGIONAL OFFICE",
    tagline: "Authorized Beverage Depot",
    address: "",
    phone: "",
    taxNumber: "",
    alignment: "center",
  },
  invoiceMeta: {
    show: true,
    title: "SALES RECEIPT",
    showInvoiceNo: true,
    showDate: true,
    showCashier: true,
    showSaleType: true,
  },
  customer: {
    show: true,
    showCustomerName: true,
    showPhone: true,
    showAddress: true,
    walkInLabel: "WALK-IN / CASH",
  },
  itemsTable: {
    show: true,
    showItemName: true,
    showQty: true,
    showRate: true,
    showAmount: true,
    itemDivider: "dashed",
    rowSpacing: "normal",
  },
  totals: {
    show: true,
    showSubtotal: true,
    showDiscount: true,
    showPaid: true,
    showCredit: true,
    showPaymentMethod: true,
    totalLabel: "TOTAL",
    paidLabel: "PAID",
    creditLabel: "CREDIT",
    balancePaidFullLabel: "0 (PAID FULL)",
  },
  customerLedger: {
    show: true,
    label: "Customer Ledger:",
    showOnlyIfBalance: true,
  },
  containers: {
    show: true,
    title: "Returnable Containers:",
    plasticLabel: "Plastic Crates:",
    glassLabel: "Glass Bottles:",
  },
  footer: {
    show: true,
    thankYouNote: "Thank you for your business!",
    policyNote: "Goods dispatched non-refundable without slip.",
    showBarcodeRef: true,
  },
  styling: {
    fontFamily: "sans",
    baseFontSize: "medium",
    printableWidth: "76mm",
    dividerStyle: "dashed",
  },
};

export const RECEIPT_CONFIG_STORAGE_KEY = "pepsi_receipt_design_config_v1";

/**
 * Safely merge any partial config with default values so that newly added fields
 * never cause undefined errors.
 */
export function sanitizeReceiptConfig(incoming?: unknown): ReceiptDesignConfig {
  if (!incoming || typeof incoming !== "object") {
    return { ...DEFAULT_RECEIPT_CONFIG };
  }

  const raw = incoming as Partial<ReceiptDesignConfig>;

  // Ensure valid section order contains all known sections
  let order: ReceiptSectionId[] = Array.isArray(raw.sectionOrder)
    ? raw.sectionOrder.filter((s): s is ReceiptSectionId => ALL_SECTION_IDS.includes(s))
    : [];

  // Append any missing sections to order
  ALL_SECTION_IDS.forEach((id) => {
    if (!order.includes(id)) {
      order.push(id);
    }
  });

  return {
    version: 1,
    sectionOrder: order,
    header: {
      ...DEFAULT_RECEIPT_CONFIG.header,
      ...(raw.header || {}),
    },
    invoiceMeta: {
      ...DEFAULT_RECEIPT_CONFIG.invoiceMeta,
      ...(raw.invoiceMeta || {}),
    },
    customer: {
      ...DEFAULT_RECEIPT_CONFIG.customer,
      ...(raw.customer || {}),
    },
    itemsTable: {
      ...DEFAULT_RECEIPT_CONFIG.itemsTable,
      ...(raw.itemsTable || {}),
    },
    totals: {
      ...DEFAULT_RECEIPT_CONFIG.totals,
      ...(raw.totals || {}),
    },
    customerLedger: {
      ...DEFAULT_RECEIPT_CONFIG.customerLedger,
      ...(raw.customerLedger || {}),
    },
    containers: {
      ...DEFAULT_RECEIPT_CONFIG.containers,
      ...(raw.containers || {}),
    },
    footer: {
      ...DEFAULT_RECEIPT_CONFIG.footer,
      ...(raw.footer || {}),
    },
    styling: {
      ...DEFAULT_RECEIPT_CONFIG.styling,
      ...(raw.styling || {}),
    },
  };
}

/**
 * Read receipt design from localStorage in client-side components.
 */
export function getStoredReceiptConfig(): ReceiptDesignConfig {
  if (typeof window === "undefined") {
    return DEFAULT_RECEIPT_CONFIG;
  }
  try {
    const raw = window.localStorage.getItem(RECEIPT_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_RECEIPT_CONFIG;
    return sanitizeReceiptConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_RECEIPT_CONFIG;
  }
}

/**
 * Save receipt design to localStorage in client-side components.
 */
export function setStoredReceiptConfig(config: ReceiptDesignConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECEIPT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    // Dispatch a custom event so other components listening on same window can update
    window.dispatchEvent(new CustomEvent("receipt_design_changed", { detail: config }));
  } catch (err) {
    console.error("Failed to save receipt configuration to localStorage", err);
  }
}
