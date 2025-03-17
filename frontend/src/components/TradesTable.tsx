"use client";
import { useEffect, useState } from "react";

interface FuturesPositionTrade {
  symbol: string;
  pnl: number;
  trade_amount: number;
  commission: string;
  commissionAsset: string;
  side: string;
  time: number;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

const TradesTable = () => {
  const [trades, setTrades] = useState<FuturesPositionTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch(`${backendUrl}/all-trades?days=1`);
        const data = await response.json();
        if (data.success) {
          setTrades(data.trades);
        }
      } catch (error) {
        console.error("Error fetching trades:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();

    // Subscribe to SSE updates for new trades
    const eventSource = new EventSource(`${backendUrl}/sse/trades`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "latestTrade") {
        setTrades((prevTrades) => [data.trade, ...prevTrades]); // Add new trade to top
      }
    };

    return () => {
      eventSource.close(); // Cleanup on unmount
    };
  }, []);

  return (
    <div className="mt-6">
      <h2 className="text-2xl text-gray-700 font-semibold mb-4">Trade History</h2>

      {loading ? (
        <p className="text-gray-600">Loading trades...</p>
      ) : trades.length === 0 ? (
        <p className="text-gray-600">No trades found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 bg-white shadow-md rounded-lg">
            <thead className="bg-blue-500">
              <tr className="text-left text-gray-100">
                <th className="p-3 border-b">Symbol</th>
                <th className="p-3 border-b">Side</th>
                <th className="p-3 border-b">Realized PnL</th>
                <th className="p-3 border-b">Quote Qty</th>
                <th className="p-3 border-b">Fee</th>
                <th className="p-3 border-b">Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => (
                <tr key={index} className="border-b hover:bg-gray-200">
                  <td className="p-3">{trade.symbol || "N/A"}</td>
                  <td className={`p-3 ${trade.side === "BUY" ? "text-green-600" : "text-red-600"}`}>
                    {trade.side || "N/A"}
                  </td>
                  <td className={`p-3 ${Number(trade.pnl) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {(trade.pnl).toFixed(4)} USDT
                  </td>
                  <td className="p-3">{(trade.trade_amount).toFixed(4)}</td>
                  <td className="p-3">{parseFloat(trade.commission || "0").toFixed(4)} {trade.commissionAsset || "USDT"}</td>
                  <td className="p-3">{new Date(trade.time || Date.now()).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TradesTable;