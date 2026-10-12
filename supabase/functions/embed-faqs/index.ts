// EDELICACIES — Edge Function: embed-faqs
//
// Gives every FAQ note a "meaning fingerprint" (an embedding) so the chat
// assistant can search the notes by meaning. It only touches notes that have
// no fingerprint yet (a new note, or one whose wording was just edited), so it
// is safe to call as often as you like — when nothing needs doing it does
// nothing.
//
// Paste this whole file into the Supabase dashboard's Edge Function editor
// for a function named "embed-faqs". Leave "Verify JWT" ON (default).
//
// The model (gte-small) is built into Supabase's Edge runtime: free, no extra
// secret needed. It reads English and produces 384 numbers per note.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Writing fingerprints back needs more than the public key can do, so this
// function uses the service role key (which only exists on the server).
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Built into the Supabase Edge runtime.
const model = new Supabase.ai.Session('gte-small')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Turns a piece of text into 384 numbers that capture its meaning.
async function embed(text: string): Promise<number[]> {
  const output = await model.run(text, { mean_pool: true, normalize: true })
  return Array.from(output as ArrayLike<number>)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    // Only notes that have no fingerprint yet.
    const { data: rows, error } = await supabase
      .from('faqs')
      .select('id, question, answer')
      .is('embedding', null)
      .limit(50)

    if (error) throw error
    if (!rows || rows.length === 0) return json({ embedded: 0, message: 'Nothing to do.' })

    let embedded = 0
    const failed: string[] = []

    for (const row of rows) {
      try {
        // Question + answer together, so a customer's question can match
        // either the wording of the question or the content of the answer.
        const vector = await embed(`${row.question}\n${row.answer}`)
        const { error: updateError } = await supabase
          .from('faqs')
          .update({ embedding: JSON.stringify(vector) })
          .eq('id', row.id)
        if (updateError) throw updateError
        embedded++
      } catch (err) {
        console.error('could not embed', row.id, err)
        failed.push(row.id)
      }
    }

    return json({ embedded, failed })
  } catch (err) {
    console.error('embed-faqs failed', err)
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return json({ error: message }, 500)
  }
})
