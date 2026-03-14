// apps/mobile/jest.config.js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    // Resolve workspace package to its source during tests
    '^@open-cfmoto/ble-protocol$':
      '<rootDir>/../../packages/ble-protocol/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Inline tsconfig avoids the bundler/node moduleResolution conflict.
        // Type-checking is handled separately by `pnpm typecheck`.
        diagnostics: false,
        tsconfig: {
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          moduleResolution: 'node',
          module: 'commonjs',
          target: 'ES2020',
          lib: ['ES2020'],
          resolveJsonModule: true,
        },
      },
    ],
  },
};
