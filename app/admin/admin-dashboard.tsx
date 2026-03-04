'use client';

import { useState } from 'react';
import type { Post, FallbackImage } from '@/lib/db';

interface AdminProps {
  initialPosts: Post[];
  fallbackCount: number;
  unusedFallbackCount: number;
  fallbackImages: FallbackImage[];
}

export function AdminDashboard({ initialPosts, fallbackCount, unusedFallbackCount, fallbackImages }: AdminProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [showFallbacks, setShowFallbacks] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');

  async function handleDelete(id: string) {
    if (!confirm('Delete this post?')) return;
    const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  async function handleSave(id: string) {
    const res = await fetch(`/api/admin/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: editCaption }),
    });
    if (res.ok) {
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, caption: editCaption } : p))
      );
      setEditingId(null);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-serif text-lg">Admin</h1>
          <button onClick={handleLogout} className="font-serif text-xs text-neutral-500 hover:text-white">
            Logout
          </button>
        </div>

        <div className="mb-8 flex gap-6 font-serif text-xs text-neutral-500">
          <span>{posts.length} posts</span>
          <span>{fallbackCount} fallback images</span>
          <span>{unusedFallbackCount} unused</span>
          {unusedFallbackCount === 0 && (
            <span className="text-red-400">Fallback pool empty</span>
          )}
        </div>

        <div className="space-y-6">
          {posts.map((post) => (
            <div key={post.id} className="flex gap-4 border-b border-neutral-900 pb-6">
              <img
                src={post.image_url}
                alt={post.caption}
                className="h-20 w-20 flex-shrink-0 object-cover"
              />
              <div className="flex-1">
                <time className="font-serif text-xs text-neutral-500">
                  {post.date}
                  {post.is_fallback && ' (fallback)'}
                </time>
                {editingId === post.id ? (
                  <div className="mt-1">
                    <input
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="w-full border-b border-neutral-700 bg-transparent py-1 font-serif text-sm text-white outline-none focus:border-white"
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleSave(post.id)}
                        className="font-serif text-xs text-white hover:underline"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="font-serif text-xs text-neutral-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 font-serif text-sm font-light">{post.caption}</p>
                )}
              </div>
              <div className="flex flex-shrink-0 gap-2">
                {editingId !== post.id && (
                  <button
                    onClick={() => {
                      setEditingId(post.id);
                      setEditCaption(post.caption);
                    }}
                    className="font-serif text-xs text-neutral-500 hover:text-white"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDelete(post.id)}
                  className="font-serif text-xs text-neutral-500 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Fallback images section */}
        <div className="mt-10 border-t border-neutral-900 pt-6">
          <button
            onClick={() => setShowFallbacks((v) => !v)}
            className="font-serif text-xs text-neutral-500 hover:text-white"
          >
            {showFallbacks ? 'Hide' : 'Show'} fallback images ({fallbackImages.length})
          </button>
          {showFallbacks && (
            <div className="mt-4 grid grid-cols-4 gap-3">
              {fallbackImages.map((img) => (
                <a
                  key={img.id}
                  href={img.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative"
                >
                  <img
                    src={img.image_url}
                    alt="Fallback"
                    className="aspect-square w-full object-cover opacity-80 group-hover:opacity-100"
                  />
                  <span
                    className={`absolute top-1 right-1 rounded px-1.5 py-0.5 font-serif text-[10px] ${
                      img.used
                        ? 'bg-neutral-700 text-neutral-400'
                        : 'bg-green-900 text-green-400'
                    }`}
                  >
                    {img.used ? 'used' : 'unused'}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
