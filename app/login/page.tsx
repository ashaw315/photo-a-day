'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Wrong password');
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-black">
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full border-b border-neutral-700 bg-transparent px-0 py-2 font-serif text-sm text-white outline-none placeholder:text-neutral-600 focus:border-white"
          autoFocus
        />
        {error && <p className="mt-2 font-serif text-xs text-red-400">{error}</p>}
      </form>
    </div>
  );
}
