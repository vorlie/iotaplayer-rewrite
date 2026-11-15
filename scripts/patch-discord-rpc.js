import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const targetFile = path.join(__dirname, '..', 'node_modules', 'discord-rpc', 'src', 'client.js')

if (!fs.existsSync(targetFile)) {
  console.log('[discord-rpc patch] skipped: dependency not installed yet')
  process.exit(0)
}

const source = fs.readFileSync(targetFile, 'utf8')
const expected = "details: args.details,\n        type: args.type,\n        timestamps,"

if (source.includes(expected)) {
  console.log('[discord-rpc patch] already applied')
  process.exit(0)
}

const pattern = "details: args.details,\n        timestamps,"
const replacement = "details: args.details,\n        type: args.type,\n        timestamps,"

if (!source.includes(pattern)) {
  console.error('[discord-rpc patch] target pattern not found; dependency version may have changed')
  process.exit(1)
}

fs.writeFileSync(targetFile, source.replace(pattern, replacement), 'utf8')
console.log('[discord-rpc patch] applied: client.js now forwards activity type')
