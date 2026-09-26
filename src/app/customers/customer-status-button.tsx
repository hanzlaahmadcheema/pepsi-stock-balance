"use client";

import { useState, useTransition } from "react";
import { toggleCustomerActiveAction } from "./actions";

export function CustomerStatusButton({
  customerId,
  isActive,
}: {
  customerId: string;
  isActive: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const res = await toggleCustomerActiveAction(customerId, !isActive);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <>
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          title={isActive
            ? "Hide from new entries — click again to bring it back"
            : "Make selectable again in new entries"}
          className={`btn btn-sm ${isActive ? "btn-danger" : "btn-good"}`}
        >
          {isActive ? "Stop Using" : "Use Again"}
        </button>

        {error ? (
          <span role="alert" className="text-sm font-bold text-stamp">
            {error}
          </span>
        ) : null}
      </span>
    </>
  );
}

