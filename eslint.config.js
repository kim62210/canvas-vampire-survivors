// ESLint v9+ flat config.
// See https://eslint.org/docs/latest/use/configure/configuration-files

'use strict';

module.exports = [
    {
        ignores: ['node_modules/**', '_site/**', 'coverage/**']
    },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser globals used by the game runtime.
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                console: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                performance: 'readonly',
                AudioContext: 'readonly',
                webkitAudioContext: 'readonly',
                Image: 'readonly',
                HTMLElement: 'readonly',
                HTMLCanvasElement: 'readonly',
                CanvasRenderingContext2D: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                fetch: 'readonly',
                FormData: 'readonly',
                Event: 'readonly',
                CustomEvent: 'readonly',
                structuredClone: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                prompt: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-undef': 'error',
            semi: ['warn', 'always'],
            'prefer-const': 'warn',
            eqeqeq: ['warn', 'smart'],
            'no-console': 'off'
        }
    },
    {
        files: ['server.js', '*.config.js', '*.cjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                // Node.js globals.
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'writable',
                require: 'readonly',
                exports: 'writable',
                global: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-undef': 'error',
            semi: ['warn', 'always'],
            'prefer-const': 'warn',
            eqeqeq: ['warn', 'smart'],
            'no-console': 'off'
        }
    },
    {
        // Tests run under the Node `node:test` runner as ESM modules.
        files: ['test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                global: 'readonly',
                globalThis: 'readonly',
                structuredClone: 'readonly',
                performance: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-undef': 'error',
            semi: ['warn', 'always'],
            'prefer-const': 'warn',
            eqeqeq: ['warn', 'smart'],
            'no-console': 'off'
        }
    }
];
