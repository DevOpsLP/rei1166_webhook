import GlobalPnL from "@/components/GlobalPnL";
import MaxTradesComponent from "@/components/MaxTrades";
import ServerStatus from "@/components/ServerStatus";
import TestModeToggle from "@/components/TestModeButton";
import TradesTable from "@/components/TradesTable";

// pages/index.tsx
export default function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <main className="flex-1 p-4 md:p-8">
        <div className="flex justify-between">
          <h1 className="text-3xl text-gray-700 font-bold mb-6">Dashboard</h1>
          <TestModeToggle />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <MaxTradesComponent />
          <GlobalPnL />
          <ServerStatus />
        </div>
        <TradesTable />
      </main>
    </div>
  );
}