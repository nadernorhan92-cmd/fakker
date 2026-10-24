type ReviewAnalyticsEvent =
  | 'spaced_review_previewed'
  | 'spaced_review_saved'
  | 'spaced_review_updated'
  | 'spaced_review_cancelled';

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: { review_count: number }): void;
    };
  }
}

export function trackReviewEvent(name: ReviewAnalyticsEvent, reviewCount: number): void {
  if (typeof window === 'undefined') return;

  try {
    window.umami?.track(name, { review_count: reviewCount });
  } catch {
    // Analytics must never affect review-plan operations.
  }
}
