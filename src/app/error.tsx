"use client";

import { useEffect } from "react";
import { StatusPage, statusActionClass } from "@/components/StatusPage";

// Shown if rendering the page throws. The details go to the console, not the visitor.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="ERR"
      title="Something went wrong"
      message="Scrubcast hit an error loading this page. Trying again usually fixes it."
      action={
        <button type="button" onClick={reset} className={statusActionClass}>
          Try again
        </button>
      }
    />
  );
}
