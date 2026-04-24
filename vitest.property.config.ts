import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/property/**/*.property.test.ts'],
    testTimeout: 30000,
  },
});
