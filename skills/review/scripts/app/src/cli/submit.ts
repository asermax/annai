import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

import { sessionPaths } from '../shared/paths.ts'
import { sendCommand } from './ipc-client.ts'
import { surfaceSchema } from '../shared/surface.ts'
import { resultSchema } from '../shared/result.ts'
import type { Result } from '../shared/result.ts'
import {
  buildAddReviewMutation,
  buildAddFileThreadMutation,
  buildSubmitReviewMutation,
  extractFileDrafts,
  type GraphQLCall,
} from '../daemon/submission.ts'
import { wantsHelp } from './output.ts'

const USAGE = `usage: annai.sh submit --session <id>

Fetches the result payload via IPC, queries the PR node id + head commit
OID, runs addPullRequestReview + addPullRequestReviewThread (one per
file-level draft) + submitPullRequestReview, then prints
{sessionId, reviewUrl, state, decision, commentCount}.
`

const parseArgs = (argv: string[]): { sessionId: string } => {
  let sessionId: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--session' && i + 1 < argv.length) { sessionId = argv[i + 1]; i++; continue }
    throw new Error(`submit: unknown argument "${arg}"`)
  }
  if (sessionId == null) throw new Error('submit: --session <id> is required')

  return { sessionId }
}

interface PRRef {
  owner: string
  repo: string
  number: number
}

const parsePrUrl = (url: string): PRRef => {
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (m == null || m[1] == null || m[2] == null || m[3] == null) {
    throw new Error(`submit: cannot parse PR url "${url}"`)
  }

  return { owner: m[1], repo: m[2], number: Number(m[3]) }
}

const runGh = (args: string[], stdinText?: string): Promise<string> => {
  return new Promise((resolveOuter, rejectOuter) => {
    const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })
    child.on('error', err => rejectOuter(err))
    child.on('close', code => {
      if (code === 0) {
        resolveOuter(stdout)
      } else {
        rejectOuter(new Error(`gh ${args.join(' ')} failed (exit ${code}): ${stderr.trim() || stdout.trim()}`))
      }
    })

    if (stdinText != null) child.stdin.write(stdinText)
    child.stdin.end()
  })
}

interface GHGraphQLResponse {
  data?: Record<string, unknown>
  errors?: Array<{ message: string }>
}

const ghGraphQL = async (call: GraphQLCall): Promise<Record<string, unknown>> => {
  const stdout = await runGh(['api', 'graphql', '--input', '-'], JSON.stringify(call))
  const parsed = JSON.parse(stdout) as GHGraphQLResponse
  if (parsed.errors != null && parsed.errors.length > 0) {
    throw new Error(`gh graphql: ${parsed.errors.map(e => e.message).join('; ')}`)
  }
  if (parsed.data == null) throw new Error('gh graphql: response had no data field')

  return parsed.data
}

const fetchPrNodeInfo = async (ref: PRRef): Promise<{ id: string, headRefOid: string }> => {
  const data = await ghGraphQL({
    query: `query($owner: String!, $repo: String!, $num: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $num) { id headRefOid }
  }
}`,
    variables: { owner: ref.owner, repo: ref.repo, num: ref.number },
  })

  const repository = data.repository as { pullRequest: { id: string, headRefOid: string } } | null
  if (repository?.pullRequest == null) {
    throw new Error(`submit: could not resolve ${ref.owner}/${ref.repo}#${ref.number}`)
  }

  return repository.pullRequest
}

const fetchResultViaIpc = async (sockPath: string): Promise<Result> => {
  const response = await sendCommand(sockPath, { op: 'result' }, 5000)
  if (!response.ok) throw new Error(`submit: result fetch failed: ${response.error ?? 'unknown'}`)

  return resultSchema.parse(response.data)
}

export const runSubmit = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }
  const { sessionId } = parseArgs(argv)
  const paths = sessionPaths(sessionId)

  // 1. fetch the result payload (will throw if review not yet submitted)
  const result = await fetchResultViaIpc(paths.sock)

  // 2. resolve PR owner/repo/number from the surface
  const surface = surfaceSchema.parse(JSON.parse(readFileSync(paths.surface, 'utf8')))
  const prRef = parsePrUrl(surface.pr.url)

  // 3. fetch PR node id + head commit oid
  const prInfo = await fetchPrNodeInfo(prRef)

  // 4. create pending review with line / range threads + PR body
  const addReviewData = await ghGraphQL(buildAddReviewMutation(result, prInfo.id, prInfo.headRefOid))
  const addReviewWrap = addReviewData.addPullRequestReview as { pullRequestReview: { id: string, url: string } } | null
  if (addReviewWrap?.pullRequestReview == null) {
    throw new Error('submit: addPullRequestReview returned no review')
  }
  const reviewId = addReviewWrap.pullRequestReview.id

  // 5. attach each file-level draft as a separate thread (subjectType: FILE)
  for (const fileDraft of extractFileDrafts(result)) {
    await ghGraphQL(buildAddFileThreadMutation(fileDraft, reviewId, prInfo.headRefOid))
  }

  // 6. submit the pending review with the chosen event
  const submitData = await ghGraphQL(buildSubmitReviewMutation(reviewId, result.decision))
  const submitWrap = submitData.submitPullRequestReview as { pullRequestReview: { id: string, url: string, state: string } } | null
  if (submitWrap?.pullRequestReview == null) {
    throw new Error('submit: submitPullRequestReview returned no review')
  }

  process.stdout.write(JSON.stringify({
    sessionId,
    reviewUrl: submitWrap.pullRequestReview.url,
    state: submitWrap.pullRequestReview.state,
    decision: result.decision,
    commentCount: result.comments.length,
  }) + '\n')
}
