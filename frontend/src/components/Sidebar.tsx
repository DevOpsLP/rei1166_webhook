"use client"
// components/Sidebar.tsx
import Link from 'next/link';
import { useState } from 'react';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile header with hamburger */}
      <div className="bg-gray-800 text-white p-4 md:hidden flex justify-between items-center">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <button onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>
      {/* Sidebar */}
      <aside
        className={`bg-gray-800 text-white p-6 fixed md:static inset-y-0 left-0 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out w-64 z-50 md:translate-x-0`}
      >
        <h1 className="text-2xl font-bold mb-8">Dashboard</h1>
        <ul>
          <li className="mb-4">
            <Link href="/" className="block hover:text-gray-300 hover:cursor-pointer">
              📊 Home
            </Link>
          </li>
          <li className="mb-4">
            <Link href="/api" className="block hover:text-gray-300 hover:cursor-pointer">
              🔑 API Key
            </Link>
          </li>
        </ul>
      </aside>
    </>
  );
}