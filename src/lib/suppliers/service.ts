import { prisma } from "@/lib/prisma";

export type SupplierData = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  receivingsCount: number;
};

/**
 * Lists suppliers with delivery counts.
 */
export async function listSuppliers(activeOnly = false): Promise<SupplierData[]> {
  const suppliers = await prisma.supplier.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { receivings: true },
      },
    },
  });

  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    contactPerson: s.contactPerson,
    phone: s.phone,
    address: s.address,
    isActive: s.isActive,
    createdAt: s.createdAt,
    receivingsCount: s._count.receivings,
  }));
}

/**
 * Retrieves a single supplier by ID.
 */
export async function getSupplierById(id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    include: {
      _count: {
        select: { receivings: true },
      },
    },
  });
}
