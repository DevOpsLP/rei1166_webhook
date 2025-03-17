"use client";
import { useState, useEffect } from "react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function MaxTradesComponent() {
  const [maxTrades, setMaxTrades] = useState<number | null>(null);
  const [currentTrades, setCurrentTrades] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMaxTrades, setNewMaxTrades] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [maxRes, currentRes] = await Promise.all([
          fetch(`${backendUrl}/settings/max-trades`).then((res) => res.json()),
          fetch(`${backendUrl}/settings/current-trades`).then((res) => res.json()),
        ]);

        setMaxTrades(maxRes.maxTrades);
        setCurrentTrades(currentRes.currentTrades);
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    fetchSettings();

    // Subscribe to SSE updates for current trades
    const eventSource = new EventSource(`${backendUrl}/sse/trades`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "currentTrades") {
        setCurrentTrades(data.currentTrades);
      }
    };

    return () => {
      eventSource.close(); // Cleanup SSE on unmount
    };
  }, []);

  const updateMaxTrades = async () => {
    if (!newMaxTrades || isNaN(Number(newMaxTrades))) return;

    try {
      const response = await fetch(`${backendUrl}/settings/max-trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxTrades: Number(newMaxTrades) }),
      });

      if (!response.ok) throw new Error("Failed to update max trades");

      const data = await response.json();
      setMaxTrades(data.maxTrades);
      setIsModalOpen(false);
      setNewMaxTrades("");
    } catch (error) {
      console.error("Error updating max trades:", error);
    }
  };

  return (
    <>
      <div className="p-6 rounded-md shadow bg-white">
        <h2 className="text-xl text-gray-700 font-semibold">Max Allowed Trades</h2>
        <div className="flex justify-between items-center my-4">
          <p className="text-gray-600 text-xl">
            {currentTrades} / {maxTrades ?? "Loading..."}
          </p>
        </div>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          onClick={() => setIsModalOpen(true)}
        >
          Set Max Trades
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-brightness-50">
          <div className="bg-white p-6 rounded-md shadow-lg w-96">
            <h2 className="text-xl font-semibold mb-4">Set Max Allowed Trades</h2>
            <input
              type="number"
              value={newMaxTrades}
              onChange={(e) => setNewMaxTrades(e.target.value)}
              className="w-full p-2 border rounded-md mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                onClick={updateMaxTrades}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}