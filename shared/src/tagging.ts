/**
 * Tagging Utilities
 * 
 * Helper functions for working with item tags.
 */

import { VALID_TAGS, type ValidTag } from './constants.js';

/** Tag pattern for matching */
const TAG_PATTERN = /#(\w+[-\w]*)/g;

/**
 * Extract all tags from content
 */
export function extractTags(content: string): string[] {
  const tags: string[] = [];
  let match: RegExpExecArray | null;

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * Extract only valid tags (from predefined list)
 */
export function extractValidTags(content: string): ValidTag[] {
  const allTags = extractTags(content);
  return allTags.filter((tag): tag is ValidTag =>
    VALID_TAGS.includes(tag as ValidTag)
  );
}

/**
 * Add a tag to content (if not already present)
 */
export function addTag(content: string, tag: string): string {
  const normalizedTag = tag.toLowerCase().replace(/^#/, '');
  const existingTags = extractTags(content);

  if (existingTags.includes(normalizedTag)) {
    return content;
  }

  return `#${normalizedTag} ${content}`;
}

/**
 * Remove a tag from content
 */
export function removeTag(content: string, tag: string): string {
  const normalizedTag = tag.toLowerCase().replace(/^#/, '');
  const pattern = new RegExp(`#${normalizedTag}\\b\\s*`, 'gi');
  return content.replace(pattern, '').trim();
}

/**
 * Replace one tag with another
 */
export function replaceTag(content: string, oldTag: string, newTag: string): string {
  const normalizedOld = oldTag.toLowerCase().replace(/^#/, '');
  const normalizedNew = newTag.toLowerCase().replace(/^#/, '');
  const pattern = new RegExp(`#${normalizedOld}\\b`, 'gi');
  return content.replace(pattern, `#${normalizedNew}`);
}

/**
 * Check if content has a specific tag
 */
export function hasTag(content: string, tag: string): boolean {
  const normalizedTag = tag.toLowerCase().replace(/^#/, '');
  const existingTags = extractTags(content);
  return existingTags.includes(normalizedTag);
}

/**
 * Validate that a tag is in the predefined list
 */
export function isValidTag(tag: string): tag is ValidTag {
  const normalizedTag = tag.toLowerCase().replace(/^#/, '');
  return VALID_TAGS.includes(normalizedTag as ValidTag);
}
