import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import { rollupPluginHTML as html } from '@web/rollup-plugin-html'
import { parse as parseFromString } from 'node-html-parser'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { transform } from 'sucrase'
import glob from 'tiny-glob'

export default {
  input: './**/*.html',
  output: { dir: 'dist' },
  plugins: [
    terser({
      compress: {
        passes: 2,
      },
    }),
    sucraseTransform(),
    html({
      flattenOutput: false,
      rootDir: join(process.cwd(), 'pages'),
      absoluteBaseUrl: '/',
    }),
    normalizeHTMLOutput(),
    nodeResolve(),
  ],
}

/**
 * @returns {import("rollup").Plugin}
 */
function normalizeHTMLOutput() {
  let config
  return {
    generateBundle(options) {
      config = options
    },
    async closeBundle() {
      const outDir = config.dir
      const htmlFiles = await glob('./**/*.html', {
        cwd: outDir,
      })
      const nonIndexFiles = htmlFiles.filter(d => basename(d) !== 'index.html')
      for (let file of nonIndexFiles) {
        const filePath = join(outDir, file)
        const withoutExt = basename(filePath).replace(extname(filePath), '')
        const targetFilePath = filePath.replace(
          basename(filePath),
          join(withoutExt, 'index.html')
        )

        const value = await readFile(filePath, 'utf8')
        const dom = parseFromString(value)
        const scripts = dom.getElementsByTagName('SCRIPT')

        for (const scriptIndex in scripts) {
          const scriptPath = scripts[scriptIndex].getAttribute('src')

          if (!scriptPath.startsWith('.') && !scriptPath.startsWith('/'))
            continue

          const scriptFullPath = resolve(join(dirname(filePath), scriptPath))
          const scriptPathFromTarget = relative(
            resolve(filePath),
            scriptFullPath
          )
          scripts[scriptIndex].setAttribute('src', scriptPathFromTarget)
        }

        await mkdir(dirname(targetFilePath), {
          recursive: true,
        })
        await writeFile(targetFilePath, dom.toString(), 'utf8')
        await rm(filePath, {
          force: true,
          recursive: true,
        })
      }
    },
  }
}

/**
 * @returns {import("rollup").Plugin}
 */
function sucraseTransform() {
  return {
    transform(code, id) {
      if (!id.endsWith('.js') && !id.endsWith('.jsx')) return
      const transformedCode = transform(code, {
        jsxRuntime: 'automatic',
        jsxImportSource: 'preact',
        transforms: ['jsx'],
        production: true,
      })
      return transformedCode
    },
  }
}
