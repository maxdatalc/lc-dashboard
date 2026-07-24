import { Header } from "@/components/layout/Header";

export default function HomeSubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0" style={{ paddingTop: "var(--header-offset)" }}>
        {children}
      </main>
    </>
  );
}
