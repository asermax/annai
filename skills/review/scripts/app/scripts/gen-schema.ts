/**
 * Generate references/surface.schema.json from the zod schema.
 * Run with: npm run gen:schema
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { surfaceSchema } from '../src/shared/surface.ts'

const here = dirname(fileURLToPath(import.meta.url))
const target = resolve(here, '../../../references/surface.schema.json')

const jsonSchema = zodToJsonSchema(surfaceSchema, {
  name: 'Surface',
  $refStrategy: 'root',
})

writeFileSync(target, JSON.stringify(jsonSchema, null, 2) + '\n', 'utf8')
console.log(`wrote ${target}`)
