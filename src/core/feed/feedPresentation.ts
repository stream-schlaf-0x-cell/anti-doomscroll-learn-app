export interface FeedPresentation<T> {
  scope: string;
  items: T[];
}

export function holdFeedPresentation<T>(
  previous: FeedPresentation<T>,
  latest: FeedPresentation<T>,
  reading: boolean
): FeedPresentation<T> {
  return reading && previous.scope === latest.scope ? previous : latest;
}

export function formatCurationLabel(curatedAt?: string): string {
  if (!curatedAt) return 'Kuratiert';
  const date = new Date(curatedAt);
  if (isNaN(date.getTime())) return 'Kuratiert';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `Kuratiert am ${day}.${month}.`;
}
