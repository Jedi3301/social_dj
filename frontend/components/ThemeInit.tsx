"use client";

import { useEffect } from "react";

import { usePathname } from "next/navigation";

export function ThemeInit() {
  const pathname = usePathname();

  useEffect(() => {
    const authPages = ["/login", "/register", "/complete-profile", "/forgot-password"];
    
    if (authPages.some(page => pathname?.startsWith(page))) {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      const theme = localStorage.getItem("theme") || "light";
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [pathname]);

  return null;
}
