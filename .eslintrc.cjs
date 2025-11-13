module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['next/core-web-vitals', 'eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    
    // ===== NAMING CONVENTIONS (ENGLISH ONLY) =====
    '@typescript-eslint/naming-convention': [
      'error',
      // Variables & parameters: camelCase
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow',
      },
      // Functions: camelCase
      {
        selector: 'function',
        format: ['camelCase'],
      },
      // Parameters: camelCase
      {
        selector: 'parameter',
        format: ['camelCase'],
        leadingUnderscore: 'allow',
      },
      // Types, Interfaces, Classes: PascalCase
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      // Enums: PascalCase
      {
        selector: 'enum',
        format: ['PascalCase'],
      },
      // Enum members: PascalCase or UPPER_CASE
      {
        selector: 'enumMember',
        format: ['PascalCase', 'UPPER_CASE'],
      },
      // Constants: UPPER_CASE or camelCase
      {
        selector: 'variable',
        modifiers: ['const'],
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'], // Allow PascalCase for components
      },
    ],
    
    // Warn on non-ASCII characters in identifiers (accents, etc.)
    'no-irregular-whitespace': 'error',
  }
}
