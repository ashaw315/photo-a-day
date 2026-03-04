'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Post } from '@/lib/db';

export function PhotoView({
  post,
  prevDate,
  nextDate,
}: {
  post: Post;
  prevDate: string | null;
  nextDate: string | null;
}) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);

  const goToPrev = useCallback(() => {
    if (prevDate) router.push(`/photo/${prevDate}`);
  }, [prevDate, router]);

  const goToNext = useCallback(() => {
    if (nextDate) router.push(`/photo/${nextDate}`);
  }, [nextDate, router]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'ArrowRight') goToNext();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext]);

  // Touch/swipe handling
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 50) return;
    if (diff > 0) goToPrev();
    else goToNext();
  }

  return (
    <div
      className="relative flex h-screen w-screen items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Back link */}
      <Link
        href="/"
        className="fixed top-4 left-6 z-10 font-sans no-underline"
        style={{ fontSize: '12px', color: 'var(--color-meta)', fontWeight: 300 }}
      >
        &larr; all photos
      </Link>

      {/* Previous arrow (desktop only) */}
      {prevDate && (
        <button
          onClick={goToPrev}
          className="fixed left-6 top-1/2 z-10 hidden -translate-y-1/2 cursor-pointer border-none bg-transparent font-sans md:block"
          style={{ fontSize: '14px', color: 'var(--color-meta)', fontWeight: 300 }}
          aria-label="Previous photo"
        >
          &larr;
        </button>
      )}

      {/* Next arrow (desktop only) */}
      {nextDate && (
        <button
          onClick={goToNext}
          className="fixed right-6 top-1/2 z-10 hidden -translate-y-1/2 cursor-pointer border-none bg-transparent font-sans md:block"
          style={{ fontSize: '14px', color: 'var(--color-meta)', fontWeight: 300 }}
          aria-label="Next photo"
        >
          &rarr;
        </button>
      )}

      {/* Photo + caption */}
      <div className="flex flex-col items-center" style={{ padding: '0 15vw' }}>
        <img
          src={post.image_url}
          alt={post.caption}
          className="object-contain"
          style={{ height: '90vh', maxWidth: '100%' }}
        />
        <p
          className="mt-3 font-sans text-center"
          style={{ fontSize: '13px', fontWeight: 300, color: 'var(--color-caption)' }}
        >
          {post.caption}
        </p>
        <time
          className="mt-1 block font-sans"
          style={{ fontSize: '11px', fontWeight: 300, color: 'var(--color-meta)' }}
        >
          {new Date(post.date).toLocaleDateString('en-US', {
            timeZone: 'UTC',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </time>
      </div>
    </div>
  );
}
