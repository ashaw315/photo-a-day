'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Post } from '@/lib/db';

export function Gallery({
  initialPosts,
  years,
}: {
  initialPosts: Post[];
  years: number[];
}) {
  const [allPosts, setAllPosts] = useState<Post[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPosts.length === 20 ? initialPosts[initialPosts.length - 1].date : null
  );
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !nextCursor) return;
    setLoading(true);
    const yearParam = selectedYear ? `&year=${selectedYear}` : '';
    const res = await fetch(`/api/posts?cursor=${nextCursor}&limit=20${yearParam}`);
    const data = await res.json();
    setAllPosts((prev) => [...prev, ...data.posts]);
    setNextCursor(data.nextCursor);
    setLoading(false);
  }, [loading, nextCursor, selectedYear]);

  // Year filter change
  const handleYearChange = useCallback(async (year: number | null) => {
    setSelectedYear(year);
    setLoading(true);
    const yearParam = year ? `&year=${year}` : '';
    const res = await fetch(`/api/posts?limit=20${yearParam}`);
    const data = await res.json();
    setAllPosts(data.posts);
    setNextCursor(data.nextCursor);
    setLoading(false);
  }, []);

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

  // Keyboard navigation (desktop only)
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

  // Vertical scroll → horizontal scroll mapping (desktop with fine pointer only)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(max-width: 768px)').matches) return;

    let rafId = 0;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const raw = e.deltaY + e.deltaX;
        const delta = Math.sign(raw) * Math.min(Math.abs(raw), 150);
        container.scrollLeft += delta;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      cancelAnimationFrame(rafId);
    };
  }, []);

  if (allPosts.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-meta)' }}>No photos yet.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}>
      {/* Fixed header overlay */}
      <header className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 pointer-events-none">
        <span
          className="font-sans pointer-events-auto"
          style={{ fontSize: '12px', color: 'var(--color-meta)', fontWeight: 300 }}
        >
          Photo a Day
        </span>
        <select
          className="year-select font-sans pointer-events-auto cursor-pointer"
          style={{ fontSize: '12px', color: 'var(--color-meta)', fontWeight: 300 }}
          value={selectedYear ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            handleYearChange(val ? parseInt(val, 10) : null);
          }}
        >
          <option value="">All</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </header>

      {/* Gallery container — vertical on mobile, horizontal on desktop */}
      <div
        ref={containerRef}
        className="no-scrollbar flex flex-col overflow-y-auto overflow-x-hidden pt-14 md:flex-row md:h-screen md:overflow-x-auto md:overflow-y-hidden md:items-center md:pt-0"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {allPosts.map((post, index) => (
          <article
            key={post.id}
            className={`w-full flex-shrink-0 overflow-hidden px-4 pb-6 md:w-auto md:pb-0 ${
              index === 0 ? 'md:pl-12' : 'md:pl-6'
            } ${index === allPosts.length - 1 ? 'md:pr-12' : 'md:pr-6'}`}
          >
            <div
              className="flex flex-col items-center md:items-start"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}
            >
              <div className="img-slot w-full md:w-auto">
                <Link href={`/photo/${post.date}`} className="flex h-full w-full items-center justify-center md:block">
                  <img
                    src={post.image_url}
                    alt={post.caption}
                    loading="lazy"
                    className="max-h-full w-auto object-contain md:h-full"
                  />
                </Link>
              </div>
              <p
                className="mt-2 font-sans px-2 md:px-0"
                style={{ fontSize: '13px', fontWeight: 300, color: 'var(--color-caption)' }}
              >
                {post.caption}
              </p>
              <time
                className="mt-1 block font-sans px-2 md:px-0"
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
          </article>
        ))}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-px w-full flex-shrink-0 md:h-full md:w-px" />
      </div>
    </div>
  );
}
