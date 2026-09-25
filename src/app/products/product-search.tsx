"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { IconSearch } from "@/components/ui/icons";

/** Type a product name or brand and the list narrows as you go. */
export function ProductSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleSearch(term: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set("q", term);
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="relative w-full sm:max-w-md">
      <label htmlFor="product-search" className="label">
        Find a product
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-ink-3"
        >
          <IconSearch className="h-6 w-6" />
        </span>
        <input
          id="product-search"
          type="search"
          defaultValue={defaultValue}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Type a name or brand, e.g. Pepsi"
          autoComplete="off"
          className="field pl-14"
          aria-describedby="product-search-hint"
        />
        {isPending ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-navy"
          >
            <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-rule border-t-navy" />
          </span>
        ) : null}
      </div>
      <p id="product-search-hint" className="field-help">
        The list below narrows to match what you type.
      </p>
    </div>
  );
}
