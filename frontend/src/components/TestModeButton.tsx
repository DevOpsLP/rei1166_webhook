"use client"
import { useState, useEffect, useCallback } from "react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function TestModeToggle() {
  const [testMode, setTestMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch current test mode status
  const fetchTestMode = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/settings/test-mode`);
      if (res.ok) {
        const data = await res.json();
        setTestMode(data.testMode);
      }
    } catch (err) {
      console.error("Error fetching test mode:", err);
    }
  }, []);

  // Toggle test mode status
  const toggleTestMode = async () => {
    if (testMode === null) return; // Prevent toggling if state is unknown
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/settings/test-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testMode: !testMode }),
      });

      if (res.ok) {
        setTestMode((prev) => !prev);
      } else {
        console.error("Failed to update test mode");
      }
    } catch (err) {
      console.error("Error updating test mode:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTestMode();
  }, [fetchTestMode]);

  return (
    <button
      onClick={toggleTestMode}
      disabled={loading}
      className={`mb-3 px-4 py-2 rounded-lg text-white font-semibold ${testMode ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {loading ? "Updating..." : testMode ? "Switch to Live Mode" : "Switch to Test Mode"}
    </button>
  );
}