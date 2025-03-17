"use client";
import { useState, useEffect } from "react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ServerStatus() {
  const [serverStatus, setServerStatus] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${backendUrl}/server/status`)
      .then((res) => res.json())
      .then((data) => setServerStatus(data.connected))
      .catch((err) => console.error("Error fetching server status:", err));
  }, []);

  const startServer = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/server/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to start server");
      
      const data = await response.json();
      setServerStatus(data.success);
    } catch (error) {
      console.error("Error starting server:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-md shadow bg-white">
      <h2 className="text-xl text-gray-700 font-semibold mb-4">Server Status</h2>
      {serverStatus ? (
        <div className="text-green-600 font-semibold">Server is up and waiting for new trades!</div>
      ) : (
        <div className="text-red-600 font-semibold mb-4">Server is down, set your API Key before starting it</div>
      )}
      {!serverStatus && (
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          onClick={startServer}
          disabled={loading}
        >
          {loading ? "Starting..." : "Start Server"}
        </button>
      )}
    </div>
  );
}