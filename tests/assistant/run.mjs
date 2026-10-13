#!/usr/bin/env node
// Runs the assistant test questions against the LIVE chat function.
//
//   npm run test:assistant              run all 20
//   npm run test:assistant -- 3 10 18   run only those test ids
//
// Uses the public site key from .env (the same one any visitor's browser has),
// so it tests exactly what a stranger could do. Each test starts a fresh chat,
// which you will see in Dashboard -> Inbox. The three handoff tests also send
// you alert emails.

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { QUESTIONS } from './questions.mjs'

function readEnv() {
  const env = { ...process.env }
  try {
    for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env file: rely on real environment variables */
  }
  return env
}

// Pure function so it can be unit-tested: does this response satisfy the test?
export function evaluate(test, responses) {
  const last = responses[responses.length - 1] ?? {}
  const reply = String(last.reply ?? '')
  const problems = []

  if (test.mustMatch && !test.mustMatch.some((re) => re.test(reply))) {
    problems.push(`reply should match one of: ${test.mustMatch.map(String).join(' | ')}`)
  }
  for (const re of test.mustNotMatch ?? []) {
    if (re.test(reply)) problems.push(`reply must NOT match ${re}`)
  }
  if (test.handedOff === true && !(last.handedOff === true || last.mode === 'owner')) {
    problems.push('expected the chat to be handed to a person')
  }
  if (test.handedOff === false && (last.handedOff === true || last.mode === 'owner')) {
    problems.push('chat was handed to a person but should have stayed with the assistant')
  }
  if (test.noOrder && responses.some((r) => r.orderNumber)) {
    problems.push(`an order was placed (${responses.find((r) => r.orderNumber).orderNumber})`)
  }
  if (!reply && test.handedOff !== true) problems.push('no reply came back')
  return { pass: problems.length === 0, problems, reply }
}

async function ask(url, key, message, chat) {
  const res = await fetch(`${url}/functions/v1/chat`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, ...(chat ?? {}) }),
  })
  let body = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: body ?? {} }
}

async function main() {
  const env = readEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (.env).')
    process.exit(2)
  }

  const only = process.argv.slice(2).map(Number).filter(Boolean)
  const tests = QUESTIONS.filter((q) => only.length === 0 || only.includes(q.id))
  const results = []
  let stop = false

  for (const test of tests) {
    if (stop) break
    const turns = Array.isArray(test.ask) ? test.ask : [test.ask]
    const responses = []
    let chat = null
    let failureText = null

    for (const turn of turns) {
      const { status, body } = await ask(url, key, turn, chat)
      if (status === 429) {
        failureText =
          'Rate limited (HTTP 429). Raise the "chat_limits" setting for test day, or wait an hour. Stopping.'
        stop = true
        break
      }
      if (status >= 400) {
        failureText = `HTTP ${status}: ${body.error ?? 'error'}`
        break
      }
      if (body.conversationId && body.accessToken) {
        chat = { conversationId: body.conversationId, accessToken: body.accessToken }
      }
      responses.push(body)
      await new Promise((r) => setTimeout(r, 1500))
    }

    const verdict = failureText
      ? { pass: false, problems: [failureText], reply: '' }
      : evaluate(test, responses)
    results.push({ test, ...verdict, paused: responses.some((r) => r.paused) })
    const mark = verdict.pass ? 'PASS' : 'FAIL'
    console.log(`${mark}  #${String(test.id).padStart(2)} [${test.group}] ${test.title}`)
    if (!verdict.pass) {
      for (const p of verdict.problems) console.log(`        - ${p}`)
    }
    if (verdict.reply) console.log(`        bot: ${verdict.reply.replace(/\s+/g, ' ').slice(0, 220)}`)
  }

  const passed = results.filter((r) => r.pass).length
  console.log(`\n${passed}/${results.length} passed`)
  if (results.some((r) => r.paused)) {
    console.log('Note: the assistant reported its daily limit was reached, so some answers are pauses, not real tests.')
  }

  const report = [
    `# Assistant test report`,
    ``,
    `Run: ${new Date().toISOString()}  ·  ${passed}/${results.length} passed`,
    ``,
    ...results.map(
      (r) =>
        `## ${r.pass ? 'PASS' : 'FAIL'} · #${r.test.id} ${r.test.title} (${r.test.group})\n\n` +
        `**Asked:** ${Array.isArray(r.test.ask) ? r.test.ask.join(' / ') : r.test.ask}\n\n` +
        `**Bot:** ${r.reply || '(no reply)'}\n\n` +
        (r.problems.length ? `**Problems:** ${r.problems.join('; ')}\n` : ''),
    ),
  ].join('\n')
  writeFileSync(new URL('./last-report.md', import.meta.url), report)
  console.log('Full report: tests/assistant/last-report.md')
  process.exit(passed === results.length ? 0 : 1)
}

// Run the tests only when started from the command line (not when imported).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
