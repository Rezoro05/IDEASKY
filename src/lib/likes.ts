/** Pure rules for liking an idea. For now a like belongs to a browser; account-linked likes come with sign-in. */

export type LikeState = { liked: boolean; count: number };

/** Tapping the heart: like if not liked, unlike if liked. The count never goes below zero. */
export const toggled = (s: LikeState): LikeState =>
  s.liked ? { liked: false, count: Math.max(0, s.count - 1) } : { liked: true, count: s.count + 1 };

export const likeButtonLabel = (s: LikeState): string => (s.liked ? "Unlike this idea" : "Like this idea");

/** The number shown beside the heart; nothing when there are no likes or the count is unknown. */
export const likeCountText = (count: number | null): string => (count && count > 0 ? String(count) : "");

/** PostgREST answers a counted request with a Content-Range header such as "0-24/3573" or "*\/12". */
export function countFromContentRange(header: string | null): number | null {
  const total = header?.split("/")[1];
  if (!total || !/^\d+$/.test(total)) return null;
  return Number(total);
}

/** On the public board a liked idea or dream grows a little with each like: 6% each, up to 60% bigger (10 likes). */
export const LIKE_GROWTH = { perLike: 0.06, most: 0.6 } as const;
export const likeScale = (likes: number): number => 1 + Math.min(LIKE_GROWTH.most, Math.max(0, Math.floor(likes)) * LIKE_GROWTH.perLike);
