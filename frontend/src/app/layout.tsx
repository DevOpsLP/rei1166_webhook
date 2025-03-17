// app/layout.tsx
import '../app/globals.css';
import Sidebar from '../components/Sidebar';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 bg-gray-100 p-4 md:p-8">{children}</main>
      </body>
    </html>
  );
}