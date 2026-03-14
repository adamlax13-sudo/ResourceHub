import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Load .env — try local first, then main repo root (for worktrees)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export default defineConfig({
  test: {
    include: ['server/**/*.test.ts'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
