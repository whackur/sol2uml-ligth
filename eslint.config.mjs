import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url))
const packagePath = relative(process.cwd(), tsconfigRootDir)
    .split(sep)
    .join('/')
const packagePrefix = packagePath ? `${packagePath}/` : ''

export default tseslint.config(
    {
        ignores: [
            `${packagePrefix}lib/`,
            `${packagePrefix}node_modules/`,
            `${packagePrefix}src/contracts/`,
            `${packagePrefix}src/ts/**/__tests__/**`,
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: [`${packagePrefix}src/ts/**/*.ts`],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir,
            },
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/ban-ts-comment': [
                'error',
                { 'ts-ignore': 'allow-with-description' },
            ],
            'prefer-const': ['error', { destructuring: 'all' }],
        },
    },
)
