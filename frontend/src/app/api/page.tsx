// pages/settings.tsx
import CredentialsForm from '@/components/CredentialsForm';

export default function Settings() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <main className="flex-1 p-4 md:p-8">
        <h1 className="text-3xl text-gray-700 font-bold mb-6">Settings</h1>
        <div className="bg-white p-6 rounded-md shadow">
          <CredentialsForm />
        </div>
      </main>
    </div>
  );
}