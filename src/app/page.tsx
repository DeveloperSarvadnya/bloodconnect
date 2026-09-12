import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold text-red-700">BloodConnect</h1>
      <p className="mt-3 max-w-xl text-neutral-600">
        Real-time blood donation and emergency resource locator. Find nearby
        blood banks, respond to urgent requests, and locate donation camps —
        all on one live map.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/map"
          className="rounded-md bg-red-700 px-5 py-2.5 text-white hover:bg-red-800"
        >
          View Live Map
        </Link>
        <Link
          href="/auth/register"
          className="rounded-md border border-red-700 px-5 py-2.5 text-red-700 hover:bg-red-50"
        >
          Register as Donor
        </Link>
        <Link
          href="/auth/login"
          className="rounded-md border border-neutral-300 px-5 py-2.5 text-neutral-700 hover:bg-neutral-100"
        >
          Hospital / Admin Login
        </Link>
      </div>
    </main>
  );
}
