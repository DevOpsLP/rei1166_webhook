"use client";
import { useState, useEffect } from "react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function GlobalPnL() {
  const [balance, setBalance] = useState<number | null>(null);
  const [unrealizedPnL, setUnrealizedPnL] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${backendUrl}/server/balance`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.balance) {
          setBalance(parseFloat(data.balance.availableBalance));
          setUnrealizedPnL(parseFloat(data.balance.crossUnPnl));
        } else {
          setError("Failed to fetch PnL data");
        }
      })
      .catch((err) => {
        console.error("Error fetching Global PnL:", err);
        setError("Error fetching Global PnL");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 rounded-md shadow bg-white text-center">
      <h2 className="text-xl text-gray-700 font-semibold mb-2">Available Balance</h2>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <div>
          <div className="text-3xl font-bold text-gray-900">
            {balance?.toFixed(2)} <span className="text-lg font-semibold">USDT</span>
          </div>
          <div className={`text-sm font-medium ${unrealizedPnL! >= 0 ? "text-green-600" : "text-red-600"}`}>
            ({unrealizedPnL! >= 0 ? "+" : ""}{unrealizedPnL?.toFixed(2)} USDT uPnL)
          </div>
        </div>
      )}
    </div>
  );
}