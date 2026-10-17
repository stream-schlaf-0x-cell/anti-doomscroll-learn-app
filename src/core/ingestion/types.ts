import { TopicTag, EvidenceTier, FeedItem } from '../domain/types';

export interface RawFeedSource {
  id: string;
  name: string;
  url: string;
  primaryTopic: TopicTag;
  topics: TopicTag[];
  defaultEvidenceTier: EvidenceTier;
  defaultAuthor?: string;
  language: 'de' | 'en';
  isTeachingRelated?: boolean;
  isChallengingPerspective?: boolean;
}

export interface RawFeedEntry {
  id: string;
  title: string;
  link: string;
  summary: string;
  fullContent?: string;
  author?: string;
  publishedAt: string;
  sourceId: string;
  imageUrl?: string;
  imageAltText?: string;
  imageCredit?: string;
}

export interface IngestionResult {
  sourceId: string;
  fetchedCount: number;
  newItems: FeedItem[];
  errors: string[];
}
