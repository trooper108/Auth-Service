import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { skipLibCheck: true } }]
  },
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};

export default config;
