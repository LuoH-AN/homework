"use client";

import { usePathname } from "next/navigation";
import AdminNav from "./admin-nav";
import PrimaryNav from "./primary-nav";

export default function NavShell() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  return isAdmin ? <AdminNav /> : <PrimaryNav />;
}
