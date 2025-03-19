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
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<keyof FuturesPositionTrade | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // Filtering trades based on search input
  const filteredTrades = trades.filter((trade) =>
    trade.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorting trades based on selected column
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    if (!sortKey) return 0;
    const valueA = a[sortKey];
    const valueB = b[sortKey];

    if (typeof valueA === "number" && typeof valueB === "number") {
      return sortOrder === "asc" ? valueA - valueB : valueB - valueA;
    }

    if (typeof valueA === "string" && typeof valueB === "string") {
      return sortOrder === "asc" ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    }

    return 0;
  });

  // Pagination Logic
  const totalPages = Math.ceil(sortedTrades.length / itemsPerPage);
  const paginatedTrades = sortedTrades.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handle sorting when clicking on column headers
  const handleSort = (key: keyof FuturesPositionTrade) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div className="mt-6">
      <h2 className="text-2xl text-gray-700 font-semibold mb-4">Trade History</h2>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search by symbol..."
        className="p-2 border rounded-md mb-4 w-full"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {loading ? (
        <p className="text-gray-600">Loading trades...</p>
      ) : trades.length === 0 ? (
        <p className="text-gray-600">No trades found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 bg-white shadow-md rounded-lg">
            <thead className="bg-blue-500">
              <tr className="text-left text-gray-100">
                <th className="p-3 border-b cursor-pointer" onClick={() => handleSort("symbol")}>
                  Symbol {sortKey === "symbol" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 border-b cursor-pointer" onClick={() => handleSort("side")}>
                  Side {sortKey === "side" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 border-b cursor-pointer" onClick={() => handleSort("pnl")}>
                  Realized PnL {sortKey === "pnl" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 border-b cursor-pointer" onClick={() => handleSort("trade_amount")}>
                  Quote Qty {sortKey === "trade_amount" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 border-b cursor-pointer" onClick={() => handleSort("commission")}>
                  Fee {sortKey === "commission" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-3 border-b cursor-pointer" onClick={() => handleSort("time")}>
                  Time {sortKey === "time" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrades.map((trade, index) => (
                <tr key={index} className="border-b hover:bg-gray-200">
                  <td className="p-3">{trade.symbol || "N/A"}</td>
                  <td className={`p-3 ${trade.side === "BUY" ? "text-green-600" : "text-red-600"}`}>
                    {trade.side || "N/A"}
                  </td>
                  <td className={`p-3 ${Number(trade.pnl) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {(trade.pnl).toFixed(4)} USDT
                  </td>
                  <td className="p-3">{trade.trade_amount.toFixed(4)}</td>
                  <td className="p-3">
                    {parseFloat(trade.commission || "0").toFixed(4)} {trade.commissionAsset || "USDT"}
                  </td>
                  <td className="p-3">{new Date(trade.time || Date.now()).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center mt-4">
            <button
              className="px-4 py-2 bg-gray-300 rounded-md disabled:opacity-50"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>

            <span className="text-gray-700">
              Page {currentPage} of {totalPages}
            </span>

            <button
              className="px-4 py-2 bg-gray-300 rounded-md disabled:opacity-50"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradesTable;