import { QuarantineStatus, SyncChangeAction, Role } from "@prisma/client";

export interface QuarantineFilters {
  status?: "ALL" | "QUARANTINED" | "RESOLVED";
  operationType?: string;
  errorCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SerializedQuarantineRecord {
  id: string;
  changeSequence: string;
  operationId: string;
  operationType: string;
  entityId: string;
  action: SyncChangeAction;
  payload: unknown;
  sourceDeviceId: string | null;
  errorCode: string;
  errorMessage: string;
  status: QuarantineStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionAction: string | null;
  resolutionReason: string | null;
  resolvedByUserId: string | null;
  resolvedByUser?: {
    name: string;
    role: Role;
  } | null;
}

export const BUSINESS_ERROR_EXPLANATIONS: Record<
  string,
  { title: string; explanation: string }
> = {
  AUTHORITY_VIOLATION: {
    title: "Depot Data Authority Conflict",
    explanation:
      "The Cloud attempted to overwrite local depot operational data (sales, payments, container movements), which is strictly depot-authoritative.",
  },
  CUSTOMER_AUTHORITY_DECISION_REQUIRED: {
    title: "Customer Profile Conflict",
    explanation:
      "Customer profile change flagged for review.",
  },
  UNSUPPORTED_OPERATION: {
    title: "Unrecognized Sync Operation",
    explanation:
      "Cloud sent an operation type not supported by this local version.",
  },
  INVALID_PAYLOAD: {
    title: "Malformed Data Payload",
    explanation:
      "Incoming change is missing required fields or has an invalid structure.",
  },
  CANNOT_DELETE_POSTED_RECEIVING: {
    title: "Posted Receiving Protected",
    explanation:
      "Attempted to delete a delivery intake that was already finalized into stock ledger.",
  },
  PRODUCT_NOT_FOUND: {
    title: "Referenced Product Missing",
    explanation:
      "Referenced product does not exist in local catalog.",
  },
  NO_ACTIVE_USER: {
    title: "User Inactive or Not Found",
    explanation:
      "Operation references a deactivated or non-existent user.",
  },
};

export function getBusinessErrorExplanation(errorCode: string): {
  title: string;
  explanation: string;
} {
  return (
    BUSINESS_ERROR_EXPLANATIONS[errorCode] || {
      title: "Deterministic Sync Error",
      explanation:
        "A deterministic rule prevented this change from being applied.",
    }
  );
}
