/**
 * Shared OpenAI Client Singleton
 *
 * Single lazy-initialized OpenAI client used by all search modules
 * (LLM reranker, LLM intent classifier, query enhancement).
 */

import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY is not set');
    client = new OpenAI({ apiKey, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL });
  }
  return client;
}

/**
 * Extract JSON from LLM output that may be wrapped in markdown code fences.
 * Handles: ```json ... ```, ``` ... ```, or raw JSON.
 */
export function extractJSON(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : raw.trim();
}
