/** Unit tests for security-relevant pure logic. Integration checks live in scripts/security/regression.mjs. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: { '^.+\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', esModuleInterop: true, module: 'commonjs', target: 'es2019', moduleResolution: 'node', strict: false, skipLibCheck: true }, diagnostics: false }] },
};
