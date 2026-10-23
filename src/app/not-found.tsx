import Link from "next/link";
import { StatusPage, statusActionClass } from "@/components/StatusPage";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Nothing at this timestamp"
      message="This page doesn't exist. Head back to ask a video something."
      action={
        <Link href="/" className={statusActionClass}>
          Back to Scrubcast
        </Link>
      }
    />
  );
}
