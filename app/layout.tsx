import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "La Butaca del Abuelo · Noticias",
  description: "La selección de noticias del equipo de La Butaca del Abuelo.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
