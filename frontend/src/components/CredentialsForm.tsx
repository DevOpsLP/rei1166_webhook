"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface Credential {
  id: number;
  api_key: string;
  api_secret: string;
  trade_amount: number;
  leverage: number;
}

export default function CredentialsManager() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [balance, setBalance] = useState("");
  const [leverage, setLeverage] = useState("");

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/credentials`);
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [backendUrl]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const maskString = (str: string) =>
    str.length <= 4 ? str : `${str.slice(0, 2)}***${str.slice(-2)}`;

  const handleDelete = async (id: number) => {
    await fetch(`${backendUrl}/credentials?id=${id}`, { method: "DELETE" });
    fetchCredentials();
  };

  const handleEdit = (cred: Credential) => {
    setSelectedCredential(cred);
    setApiKey(cred.api_key);
    setApiSecret(cred.api_secret);
    setBalance(String(cred.trade_amount));
    setLeverage(String(cred.leverage));
    setEditing(true);
    setShowForm(true);
  };

  const handleSave = async () => {
    const endpoint = `${backendUrl}/credentials`;
    const method = editing ? "PUT" : "POST";
    const payload = editing && selectedCredential ? { id: selectedCredential.id, apiKey, apiSecret, balance, leverage } : { apiKey, apiSecret, balance, leverage };

    await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setShowForm(false);
    setEditing(false);
    setSelectedCredential(null);
    setApiKey("");
    setApiSecret("");
    setBalance("");
    setLeverage("");
    fetchCredentials();
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(false);
    setSelectedCredential(null);
  };

  return (
    <div className="bg-white p-6 shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-5">API Credentials</h2>

      {loading ? (
        <div className="text-gray-500 animate-pulse">Loading...</div>
      ) : credentials.length === 0 ? (
        <div
          className="border-2 border-dashed border-gray-400 p-4 text-center cursor-pointer rounded-md"
          onClick={() => setShowForm(true)}
        >
          + Add New Credential
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-50 rounded-lg shadow-md overflow-hidden">
            <thead className="bg-blue-500 text-white">
              <tr>
                <th className="py-3 px-4 text-left">API Key</th>
                <th className="py-3 px-4 text-left">API Secret</th>
                <th className="py-3 px-4 text-center">Balance</th>
                <th className="py-3 px-4 text-center">Leverage</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {credentials.map((cred) => (
                <tr key={cred.id} className="border-b hover:bg-gray-100">
                  <td className="py-2 px-4 text-left">{maskString(cred.api_key)}</td>
                  <td className="py-2 px-4 text-left">{maskString(cred.api_secret)}</td>
                  <td className="py-2 px-4 text-center">{cred.trade_amount} USDT</td>
                  <td className="py-2 px-4 text-center">x{cred.leverage}</td>
                  <td className="py-2 px-4 flex gap-3 justify-center">
                    <button onClick={() => handleEdit(cred)}>
                      <Image src="/edit.svg" alt="Edit" width={20} height={20} />
                    </button>
                    <button onClick={() => handleDelete(cred.id)}>
                      <Image src="/trash.svg" alt="Delete" width={20} height={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">
            {editing ? "Edit Credential" : "Add New Credential"}
          </h3>
          <div className="mb-4">
            <label className="block text-sm mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full border border-gray-100 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter API Key"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-1">API Secret</label>
            <input
              type="text"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className="w-full border border-gray-100 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter API Secret"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-1">Amount per Trade</label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full border border-gray-100 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Trade Balance"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-1">Leverage</label>
            <input
              type="number"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="w-full border border-gray-100 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Leverage"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleSave}
              className="flex items-center bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
            >
              <svg
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M16.707 5.293a1 1 0 00-1.414 0L9 11.586 5.707 8.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l7-7a1 1 0 000-1.414z" />
              </svg>
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
            >
              <svg
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 8.586l4.95-4.95a1 1 0 111.414 1.414L11.414 10l4.95 4.95a1 1 0 01-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 01-1.414-1.414L8.586 10 3.636 5.05A1 1 0 015.05 3.636L10 8.586z" />
              </svg>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}