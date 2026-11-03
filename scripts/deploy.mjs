/**
 * Builds the studio and publishes dist/ to the gh-pages branch of this repository's "origin" remote.
 * GitHub Pages serves that branch at https://<user>.github.io/venture-3d-studio/.
 * Uses your normal Git credentials (Git Credential Manager on Windows).
 */
import { execSync } from 'node:child_process'
import { copyFileSync, rmSync, writeFileSync } from 'node:fs'

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })
const origin = execSync('git remote get-url origin').toString().trim()
run('npm run build')
writeFileSync('dist/.nojekyll', '')
copyFileSync('dist/index.html', 'dist/404.html')
rmSync('dist/.git', { recursive: true, force: true })
const opts = { cwd: 'dist' }
run('git init -q', opts)
run('git checkout -q -b gh-pages', opts)
run('git add -A', opts)
run(`git -c user.name="Venture 3D Studio Deploy" -c user.email="deploy@users.noreply.github.com" commit -q -m "Deploy ${new Date().toISOString()}"`, opts)
run(`git push -f "${origin}" gh-pages`, opts)
rmSync('dist/.git', { recursive: true, force: true })
console.log('\nPublished to the gh-pages branch of', origin)
