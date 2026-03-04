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
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Map<number, HTMLElement>>(new Map());

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
    setCurrentIndex(0);
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

  // IntersectionObserver to track current visible slide
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index)) {
              setCurrentIndex(index);
            }
          }
        }
      },
      { root: container, threshold: 0.5 }
    );

    for (const [, el] of slideRefs.current) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [allPosts.length]);

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

  // Vertical scroll → horizontal scroll mapping (mouse/trackpad only, not touch)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      container.scrollLeft += e.deltaY + e.deltaX;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  function shouldRenderImage(index: number): boolean {
    return Math.abs(index - currentIndex) <= 2;
  }

  function setSlideRef(index: number, el: HTMLElement | null) {
    if (el) {
      slideRefs.current.set(index, el);
    } else {
      slideRefs.current.delete(index);
    }
  }

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

      {/* Horizontal scroll container — film strip layout */}
      <div
        ref={containerRef}
        className="no-scrollbar flex h-screen overflow-x-auto overflow-y-hidden items-end"
        style={{
          gap: '16px',
          paddingLeft: '24px',
          paddingRight: '24px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Render posts newest-first (already ORDER BY date DESC from API) */}
        {allPosts.map((post, index) => (
          <article
            key={post.id}
            ref={(el) => setSlideRef(index, el)}
            data-index={index}
            className="overflow-hidden"
            style={{ width: '100vw', flexShrink: 0 }}
          >
            <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}>
              <div className="flex flex-col items-start px-4 pb-6">
                {shouldRenderImage(index) ? (
                  <Link href={`/photo/${post.date}`}>
                    <img
                      src={post.image_url}
                      alt={post.caption}
                      className="object-contain"
                      style={{ maxWidth: '100%', width: 'auto', height: 'auto', maxHeight: '75vh' }}
                    />
                  </Link>
                ) : (
                  <div
                    style={{ maxHeight: '75vh', aspectRatio: '3/2', width: '100%' }}
                  />
                )}
                <p
                  className="mt-2 font-sans"
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
          </article>
        ))}

        {/* Sentinel for infinite scroll (loads older posts) */}
        <div ref={sentinelRef} className="h-full w-px flex-shrink-0" />
      </div>
    </div>
  );
}
