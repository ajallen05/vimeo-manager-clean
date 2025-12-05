// Shared utility functions for the Vimeo Manager application
// Consolidates duplicate functions from routes.ts, export-routes.ts, etc.

import fs from 'fs/promises';
import { isDevelopment } from './constants';

/**
 * Format duration in seconds to HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');
  
  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

/**
 * Escape value for CSV format
 */
export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format date to locale string with fallback
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '[Date not available]';
  try {
    return new Date(date).toLocaleString();
  } catch {
    return '[Invalid date format]';
  }
}

/**
 * Safely clean up a file, ignoring if it doesn't exist
 */
export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    if (isDevelopment()) {
      console.log(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`Failed to clean up file ${filePath}:`, error);
    }
  }
}

/**
 * Convert VTT content to plain text
 */
export function convertVttToText(vttContent: string): string {
  if (!vttContent) return '';
  
  const lines = vttContent.split('\n');
  const textLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines, headers, metadata, cue numbers, and timestamps
    if (!trimmed) continue;
    if (trimmed.startsWith('WEBVTT')) continue;
    if (trimmed.startsWith('NOTE') || trimmed.startsWith('STYLE') || trimmed.startsWith('REGION')) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (trimmed.includes('-->')) continue;
    
    // Clean up caption text
    const cleanText = trimmed
      .replace(/<[^>]*>/g, '') // Remove HTML/VTT tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
    
    if (cleanText) {
      textLines.push(cleanText);
    }
  }
  
  return textLines.join('\n').trim();
}

/**
 * Create a sanitized filename from a string
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\s\-\.]/g, '_').trim();
}

/**
 * Production-aware logging utility
 */
export const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment()) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (isDevelopment()) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
};

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff delay calculator
 */
export function getBackoffDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

