import { TopicTag, EvidenceTier, FeedItem } from '../domain/types';

export type ReliabilityTier = 'tier_a' | 'tier_b' | 'tier_c' | 'tier_d';

export type SourceDomain =
  | 'quality_news'
  | 'fact_check'
  | 'science_research'
  | 'open_source'
  | 'mental_health_wellbeing'
  | 'law_ethics_privacy'
  | 'datasets'
  | 'tools_standards'
  | 'official_reference';

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
  reliabilityTier?: ReliabilityTier;
  sourceDomain?: SourceDomain;
  defaultEnabled?: boolean;
  homepageUrl?: string;
  description?: string;
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
