'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Post } from '@/lib/db';

export function Gallery({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPosts.length === 20 ? initialPosts[initialPosts.length - 1].date : null
  );
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !nextCursor) return;
    setLoading(true);
    const res = await fetch(`/api/posts?cursor=${nextCursor}&limit=20`);
    const data = await res.json();
    setPosts((prev) => [...prev, ...data.posts]);
    setNextCursor(data.nextCursor);
    setLoading(false);
  }, [loading, nextCursor]);

  // Infinite scroll — load more when sentinel becomes visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { root: containerRef.current, rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const container = containerRef.current;
      if (!container) return;

      if (e.key === 'ArrowRight') {
        container.scrollBy({ left: container.clientWidth, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        container.scrollBy({ left: -container.clientWidth, behavior: 'smooth' });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to the end (most recent) on load
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollLeft = container.scrollWidth;
    }
  }, []);

  if (posts.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="font-serif text-sm text-neutral-400">No photos yet.</p>
      </div>
    );
  }

  // Reverse so oldest is on the left, newest on the right
  const ordered = [...posts].reverse();

  return (
    <div
      ref={containerRef}
      className="flex h-screen snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
    >
      <div ref={sentinelRef} className="h-full w-px flex-shrink-0" />
      {ordered.map((post) => (
        <article
          key={post.id}
          className="relative flex h-full w-screen flex-shrink-0 snap-center items-center justify-center bg-black"
        >
          <img
            src={post.image_url}
            alt={post.caption}
            loading="lazy"
            className="h-full w-full object-contain"
          />
          <div className="absolute bottom-0 left-0 p-6">
            <p className="font-serif text-sm font-normal text-white/90">
              {post.caption}
            </p>
            <time className="mt-1 block font-serif text-xs text-white/50">
              {new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </time>
          </div>
        </article>
      ))}
    </div>
  );
}
