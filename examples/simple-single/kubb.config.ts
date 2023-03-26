import { defineConfig } from '@kubb/core'
import createSwagger from '@kubb/swagger'
import createSwaggerTS from '@kubb/swagger-ts'
import createSwaggerReactQuery from '@kubb/swagger-tanstack-query'

export default defineConfig({
  root: '.',
  input: {
    path: './petStore.yaml',
  },
  output: {
    path: './src/gen',
    clean: true,
  },
  hooks: {
    done: 'eslint --fix ./src/gen',
  },
  logLevel: 'warn',
  plugins: [createSwagger({}), createSwaggerTS({ output: 'models.ts' }), createSwaggerReactQuery({ output: './hooks.ts' })],
})
