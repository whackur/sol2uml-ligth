// jest.config.js
module.exports = {
    verbose: true,
    transform: {
        '^.+\\.[tj]sx?$': [
            'ts-jest',
            {
                tsconfig: {
                    allowJs: true,
                    isolatedModules: true,
                    types: ['node', 'jest'],
                },
            },
        ],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transformIgnorePatterns: ['/node_modules/(?!(file-url)/)'],
    testPathIgnorePatterns: ['/build/', '/node_modules/', '<rootDir>/\\.worktress/'],
    testRegex: '/__tests__/(?!.*\\.integration\\.test\\.ts$).*\\.test\\.ts$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testEnvironment: 'node',
}
