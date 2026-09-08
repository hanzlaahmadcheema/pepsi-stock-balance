import { prisma } from "@/lib/prisma";
import { PriceTier, PaymentMethod, SaleStatus, ContainerType, ContainerMovementType, Prisma } from "@prisma/client";

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  priceTier: PriceTier;
  creditAllowed: boolean;
  isActive: boolean;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  createdAt: Date;
};

export type CustomerLedgerEntry = {
  id: string;
  date: Date;
  type: "INVOICE" | "PAYMENT";
  reference: string;
  status?: string;
  description: string;
  paymentMethod?: PaymentMethod;
  debit: number; // Invoiced charge
  credit: number; // Payment received
  saleId?: string | null;
};

export type CustomerDetailData = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  priceTier: PriceTier;
  creditAllowed: boolean;
  isActive: boolean;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  ledger: CustomerLedgerEntry[];
  plasticCrateBalance: number;
  glassBottleBalance: number;
  containerMovements: {
    id: string;
    containerType: string;
    movementType: string;
    quantity: number;
    notes: string | null;
    createdAt: Date;
  }[];
  createdAt: Date;
};

/**
 * Calculates customer outstanding balance inside a transaction or standard client.
 */
export async function getCustomerOutstandingInTx(
  tx: Prisma.TransactionClient,
  customerId: string
): Promise<{ totalBilled: number; totalPaid: number; outstandingBalance: number }> {
  // 1. Sum all non-cancelled sales
  const sales = await tx.sale.findMany({
    where: {
      customerId,
      status: SaleStatus.COMPLETED,
    },
    select: {
      totalAmount: true,
    },
  });

  const totalBilled = sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);

  // 2. Sum all valid payments for this customer:
  // Payments either account-level (saleId = null) OR attached to COMPLETED sales
  const payments = await tx.payment.findMany({
    where: {
      customerId,
      OR: [
        { saleId: null },
        {
          sale: {
            status: SaleStatus.COMPLETED,
          },
        },
      ],
    },
    select: {
      amount: true,
    },
  });

  const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const outstandingBalance = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

  return {
    totalBilled: Math.round(totalBilled * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    outstandingBalance,
  };
}

/**
 * Lists customers with calculated financial outstanding balances.
 */
export async function listCustomers(searchTerm?: string): Promise<CustomerSummary[]> {
  const trimmed = searchTerm?.trim();

  const whereClause: Prisma.CustomerWhereInput = trimmed
    ? {
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { phone: { contains: trimmed, mode: "insensitive" } },
        ],
      }
    : {};

  const customers = await prisma.customer.findMany({
    where: whereClause,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      sales: {
        where: { status: SaleStatus.COMPLETED },
        select: { totalAmount: true },
      },
      payments: {
        where: {
          OR: [
            { saleId: null },
            {
              sale: {
                status: SaleStatus.COMPLETED,
              },
            },
          ],
        },
        select: { amount: true },
      },
    },
  });

  return customers.map((c) => {
    const totalBilled = c.sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
    const totalPaid = c.payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const outstandingBalance = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      priceTier: c.priceTier,
      creditAllowed: c.creditAllowed,
      isActive: c.isActive,
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      outstandingBalance,
      createdAt: c.createdAt,
    };
  });
}

/**
 * Returns customer profile with complete financial ledger history.
 */
export async function getCustomerDetails(customerId: string): Promise<CustomerDetailData | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      sales: {
        orderBy: { soldAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          soldAt: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          creditAmount: true,
        },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        include: {
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    return null;
  }

  // Calculate totals
  const validSales = customer.sales.filter((s) => s.status === SaleStatus.COMPLETED);
  const totalBilled = validSales.reduce((acc, s) => acc + Number(s.totalAmount), 0);

  const validPayments = customer.payments.filter(
    (p) => !p.sale || p.sale.status === SaleStatus.COMPLETED
  );
  const totalPaid = validPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const outstandingBalance = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

  // Construct combined chronological ledger
  const ledger: CustomerLedgerEntry[] = [];

  for (const s of customer.sales) {
    ledger.push({
      id: s.id,
      date: s.soldAt,
      type: "INVOICE",
      reference: s.invoiceNumber,
      status: s.status,
      description: `Invoice #${s.invoiceNumber}${
        s.status === SaleStatus.CANCELLED ? " (CANCELLED)" : ""
      }`,
      debit: s.status === SaleStatus.COMPLETED ? Number(s.totalAmount) : 0,
      credit: 0,
      saleId: s.id,
    });
  }

  for (const p of customer.payments) {
    const isCancelledSalePayment = p.sale && p.sale.status === SaleStatus.CANCELLED;
    ledger.push({
      id: p.id,
      date: p.paidAt,
      type: "PAYMENT",
      reference: p.referenceNumber || (p.sale ? `Inv #${p.sale.invoiceNumber}` : "Account Payment"),
      status: isCancelledSalePayment ? "CANCELLED_SALE" : "SETTLED",
      description: p.sale
        ? `Payment for Inv #${p.sale.invoiceNumber} (${p.paymentMethod})${
            isCancelledSalePayment ? " [Sale Cancelled]" : ""
          }`
        : `Account lump-sum payment (${p.paymentMethod})`,
      paymentMethod: p.paymentMethod,
      debit: 0,
      credit: isCancelledSalePayment ? 0 : Number(p.amount),
      saleId: p.saleId,
    });
  }

  // Sort descending by date
  ledger.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Fetch container movements
  const containerMovements = await prisma.containerMovement.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      containerType: true,
      movementType: true,
      quantity: true,
      notes: true,
      createdAt: true,
    },
  });

  // Compute balances: DEBIT increases what customer owes back, CREDIT reduces it
  let plasticCrateBalance = 0;
  let glassBottleBalance = 0;
  for (const cm of containerMovements) {
    const delta =
      cm.movementType === ContainerMovementType.DEBIT ? cm.quantity : -cm.quantity;
    if (cm.containerType === ContainerType.PLASTIC_CRATE) {
      plasticCrateBalance += delta;
    } else if (cm.containerType === ContainerType.GLASS_BOTTLE) {
      glassBottleBalance += delta;
    }
  }

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    priceTier: customer.priceTier,
    creditAllowed: customer.creditAllowed,
    isActive: customer.isActive,
    totalBilled: Math.round(totalBilled * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    outstandingBalance,
    ledger,
    plasticCrateBalance: Math.max(0, plasticCrateBalance),
    glassBottleBalance: Math.max(0, glassBottleBalance),
    containerMovements: containerMovements.map((cm) => ({
      id: cm.id,
      containerType: cm.containerType,
      movementType: cm.movementType,
      quantity: cm.quantity,
      notes: cm.notes,
      createdAt: cm.createdAt,
    })),
    createdAt: customer.createdAt,
  };
}

/**
 * Creates a customer.
 */
export async function createCustomer(data: {
  name: string;
  phone?: string;
  address?: string;
  priceTier: PriceTier;
  creditAllowed: boolean;
}) {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Customer name is required.");
  }

  return prisma.customer.create({
    data: {
      name: trimmedName,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      priceTier: data.priceTier,
      creditAllowed: data.creditAllowed,
    },
  });
}

/**
 * Updates a customer (Owner only).
 */
export async function updateCustomer(
  id: string,
  data: {
    name: string;
    phone?: string;
    address?: string;
    priceTier: PriceTier;
    creditAllowed: boolean;
  }
) {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Customer name is required.");
  }

  return prisma.customer.update({
    where: { id },
    data: {
      name: trimmedName,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      priceTier: data.priceTier,
      creditAllowed: data.creditAllowed,
    },
  });
}

/**
 * Sets customer active status (Owner only).
 */
export async function setCustomerActive(id: string, isActive: boolean) {
  return prisma.customer.update({
    where: { id },
    data: { isActive },
  });
}

/**
 * Records an account-level lump-sum payment against a customer's balance.
 */
export async function recordAccountPayment(data: {
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  userId: string;
}) {
  const { customerId, amount, paymentMethod, referenceNumber, userId } = data;

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Verify customer exists and is active
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new Error("Customer not found.");
    }
    if (!customer.isActive) {
      throw new Error("Cannot record payment for an inactive customer.");
    }

    // 2. Authoritative check on outstanding balance
    const { outstandingBalance } = await getCustomerOutstandingInTx(tx, customerId);

    // Allow slight float leeway for rounding
    if (amount > outstandingBalance + 0.009) {
      throw new Error(
        `Payment amount ($${amount.toFixed(2)}) exceeds current outstanding balance ($${outstandingBalance.toFixed(2)}).`
      );
    }

    const decimalAmount = new Prisma.Decimal(amount.toFixed(2));

    // 3. Create account-level payment
    const payment = await tx.payment.create({
      data: {
        customerId,
        saleId: null, // Account-level payment
        amount: decimalAmount,
        paymentMethod,
        referenceNumber: referenceNumber?.trim() || null,
        receivedById: userId,
      },
    });

    // 4. Create Audit Log
    await tx.auditLog.create({
      data: {
        userId,
        action: "CUSTOMER_PAYMENT",
        entityType: "Payment",
        entityId: payment.id,
        newValues: {
          customerId,
          customerName: customer.name,
          amount: amount.toFixed(2),
          paymentMethod,
          referenceNumber: referenceNumber?.trim() || null,
          previousOutstanding: outstandingBalance.toFixed(2),
          newOutstanding: Math.max(0, outstandingBalance - amount).toFixed(2),
        },
        reason: `Account payment received for customer ${customer.name}`,
      },
    });

    return payment;
  });
}
