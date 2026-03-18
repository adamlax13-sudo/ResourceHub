/**
 * Shared embedding generation helper.
 * Used by admin-services routes and storage auto-refresh.
 */
import { getOpenAI } from './openai';

export async function generateEmbedding(service: {
  name: string;
  description?: string | null;
  category?: string | null;
  tags?: any;
}): Promise<number[]> {
  const openai = getOpenAI();
  const parts = [service.name];
  if (service.description) parts.push(service.description);
  if (service.category) parts.push(service.category);
  if (Array.isArray(service.tags)) parts.push(service.tags.join(' '));
  const text = parts.join(' ').slice(0, 8000);

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}
