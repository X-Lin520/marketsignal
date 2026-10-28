import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/providers/theme-provider";
import { LanguageProvider } from "@/providers/language-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import type { Language } from "@/lib/i18n/translations";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketSignal — AI-Powered Market Intelligence",
  description:
    "24/7 automated financial news monitoring with AI-driven sentiment analysis, summarization, and actionable investment insights.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("marketsignal-language")?.value;
  const initialLanguage: Language =
    langCookie === "zh" || langCookie === "en"
      ? langCookie
      : (await headers()).get("accept-language")?.toLowerCase().startsWith("zh")
        ? "zh"
        : "en";

  return (
    <html
      lang={initialLanguage === "zh" ? "zh-CN" : "en"}
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <LanguageProvider initialLanguage={initialLanguage}>
            <TooltipProvider>
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
