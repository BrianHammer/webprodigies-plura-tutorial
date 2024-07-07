import React from "react";
import Navigation from "./navigation";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <main className="h-full">
        <Navigation />
        {children}
      </main>
    </ClerkProvider>
  );
};

export default Layout;
