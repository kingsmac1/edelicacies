import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'

interface WhatsAppStatus {
  secrets: Record<string, boolean>
  webhookUrl: string
  lastWebhookAt: string | null
}

interface WhatsAppConfig {
  phone_number_id: string
  owner_alert_number: string
  template_order_confirmed: string
  template_owner_alert: string
  template_owner_code: string
  template_language: string
}

const EMPTY_CONFIG: WhatsAppConfig = {
  phone_number_id: '',
  owner_alert_number: '',
  template_order_confirmed: 'order_confirmed',
  template_owner_alert: 'owner_chat_alert',
  template_owner_code: 'owner_verification',
  template_language: 'en',
}

const SECRET_HELP: Record<string, string> = {
  WHATSAPP_ACCESS_TOKEN: 'Permanent access token from your Meta developer app',
  WHATSAPP_VERIFY_TOKEN: 'Any long random text you invent (you paste the same text into Meta)',
  WHATSAPP_APP_SECRET: 'Meta app → Settings → Basic → App secret',
}

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3">
      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words rounded-xl bg-ink-50 px-3 py-2 text-[13px] text-ink-700">
          {value}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

export function OwnerWhatsApp() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [config, setConfig] = useState<WhatsAppConfig>(EMPTY_CONFIG)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [assistantOn, setAssistantOn] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    const { data, error } = await supabase.functions.invoke('whatsapp', { body: { action: 'status' } })
    if (error || !data) {
      setState('missing')
      return
    }
    setStatus((typeof data === 'string' ? JSON.parse(data) : data) as WhatsAppStatus)
    setState('ready')
  }, [])

  const loadConfig = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_config')
      .select(
        'phone_number_id, owner_alert_number, template_order_confirmed, template_owner_alert, template_owner_code, template_language, assistant_enabled',
      )
      .eq('id', true)
      .maybeSingle()
    if (data) {
      setAssistantOn(data.assistant_enabled !== false)
      setConfig({
        phone_number_id: data.phone_number_id ?? '',
        owner_alert_number: data.owner_alert_number ?? '',
        template_order_confirmed: data.template_order_confirmed ?? 'order_confirmed',
        template_owner_alert: data.template_owner_alert ?? 'owner_chat_alert',
        template_owner_code: data.template_owner_code ?? 'owner_verification',
        template_language: data.template_language ?? 'en',
      })
    }
  }, [])

  useEffect(() => {
    void load()
    void loadConfig()
  }, [load, loadConfig])

  async function toggleAssistant() {
    const next = !assistantOn
    setToggling(true)
    setToggleError(null)
    const { error } = await supabase
      .from('whatsapp_config')
      .update({ assistant_enabled: next, updated_at: new Date().toISOString() })
      .eq('id', true)
    setToggling(false)
    if (error) {
      setToggleError('Could not change this. Please run the latest SQL (assistant_enabled) and try again.')
      return
    }
    setAssistantOn(next)
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)
    const clean = (v: string) => v.trim()
    const { error } = await supabase
      .from('whatsapp_config')
      .update({
        phone_number_id: clean(config.phone_number_id).replace(/\D/g, '') || null,
        owner_alert_number: clean(config.owner_alert_number).replace(/\D/g, '') || null,
        template_order_confirmed: clean(config.template_order_confirmed) || 'order_confirmed',
        template_owner_alert: clean(config.template_owner_alert) || 'owner_chat_alert',
        template_owner_code: clean(config.template_owner_code) || 'owner_verification',
        template_language: clean(config.template_language) || 'en',
        updated_at: new Date().toISOString(),
      })
      .eq('id', true)
    setSaving(false)
    if (error) {
      setSaveMsg('Could not save. Please run the latest SQL (whatsapp_config) and try again.')
      return
    }
    setSaveMsg('Saved.')
    void load()
  }

  const connected = status ? Object.values(status.secrets).every(Boolean) && config.phone_number_id !== '' : false
  const inputClass =
    'min-h-11 w-full rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">WhatsApp</h1>
      <p className="mt-1 text-[14px] text-ink-400">
        Connect the Edelicacies WhatsApp number so the assistant answers there too. Customers' chats then appear in your
        Inbox, with the same Take over and Hand back buttons.
      </p>

      <div
        className={`mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 ring-1 ${
          assistantOn ? 'bg-white ring-ink-100' : 'bg-amber-50 ring-amber-200'
        }`}
      >
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink-800">
            Assistant on WhatsApp: {assistantOn ? 'On' : 'Paused'}
          </h2>
          <p className="mt-1 text-[13px] text-ink-500">
            {assistantOn
              ? 'The assistant answers every customer who writes to the WhatsApp number.'
              : 'Customers who write are not answered by the assistant. Their messages wait in your Inbox, and you reply yourself.'}
          </p>
          {toggleError && <p className="mt-1 text-[13px] font-medium text-brand-600">{toggleError}</p>}
        </div>
        <Button variant={assistantOn ? 'secondary' : 'primary'} onClick={() => void toggleAssistant()} disabled={toggling}>
          {toggling ? 'Saving…' : assistantOn ? 'Pause the assistant' : 'Turn the assistant on'}
        </Button>
      </div>

      <form onSubmit={saveConfig} className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink-100">
        <h2 className="text-[15px] font-semibold text-ink-800">Your WhatsApp details</h2>
        <p className="mt-1 text-[13px] text-ink-500">
          Fill these in when the number is ready. Changing the number later is just editing this box and saving.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">Phone number ID</span>
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="From Meta → WhatsApp → API setup"
              value={config.phone_number_id}
              onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
            />
            <span className="mt-1 block text-[12px] text-ink-400">Not the phone number itself: a long ID Meta shows.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">Your personal number for alerts</span>
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="2348012345678"
              value={config.owner_alert_number}
              onChange={(e) => setConfig({ ...config, owner_alert_number: e.target.value })}
            />
            <span className="mt-1 block text-[12px] text-ink-400">Digits only, with 234. Optional.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">Order-confirmed template name</span>
            <input
              className={inputClass}
              value={config.template_order_confirmed}
              onChange={(e) => setConfig({ ...config, template_order_confirmed: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">Owner-alert template name</span>
            <input
              className={inputClass}
              value={config.template_owner_alert}
              onChange={(e) => setConfig({ ...config, template_owner_alert: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">Verification-code template name</span>
            <input
              className={inputClass}
              value={config.template_owner_code}
              onChange={(e) => setConfig({ ...config, template_owner_code: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-700">Template language code</span>
            <input
              className={inputClass}
              value={config.template_language}
              onChange={(e) => setConfig({ ...config, template_language: e.target.value })}
            />
            <span className="mt-1 block text-[12px] text-ink-400">en for English. It must match the templates in Meta.</span>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save details'}
          </Button>
          {saveMsg && <span className="text-[13px] font-medium text-ink-600">{saveMsg}</span>}
        </div>
      </form>

      {state === 'loading' && <p className="mt-6 text-[14px] text-ink-400">Checking…</p>}

      {state === 'missing' && (
        <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-[14px] text-amber-900 ring-1 ring-amber-200">
          <p className="font-semibold">The WhatsApp function has not been deployed yet.</p>
          <p className="mt-1">
            In Supabase → Edge Functions, create a function named <strong>whatsapp</strong>, paste the code from{' '}
            <code>supabase/functions/whatsapp/index.ts</code>, turn <strong>Verify JWT off</strong>, and deploy. Then
            press Check again.
          </p>
          <div className="mt-3">
            <Button variant="secondary" onClick={() => void load()}>
              Check again
            </Button>
          </div>
        </div>
      )}

      {state === 'ready' && status && (
        <>
          <div
            className={`mt-6 rounded-2xl p-5 ring-1 ${
              connected ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-white text-ink-700 ring-ink-100'
            }`}
          >
            <p className="text-[15px] font-semibold">
              {connected ? 'All keys and details are saved. WhatsApp is ready.' : 'Waiting for the WhatsApp keys and number ID.'}
            </p>
            <p className="mt-1 text-[13px]">
              {status.lastWebhookAt
                ? `Last message from WhatsApp: ${new Date(status.lastWebhookAt).toLocaleString('en-GB')}`
                : 'No message has come in from WhatsApp yet.'}
            </p>
          </div>

          <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink-100">
            <h2 className="text-[15px] font-semibold text-ink-800">1. Secret keys saved in Supabase Secrets</h2>
            <p className="mt-1 text-[13px] text-ink-500">
              Supabase → Edge Functions → Secrets. These three stay there on purpose, so they never touch the website or
              the database.
            </p>
            <ul className="mt-3 space-y-2">
              {Object.entries(status.secrets).map(([name, ok]) => (
                <li key={name} className="flex items-start gap-2 text-[14px]">
                  <span className={ok ? 'text-emerald-600' : 'text-ink-300'} aria-hidden>
                    {ok ? '✓' : '○'}
                  </span>
                  <span>
                    <span className="font-semibold text-ink-800">{name}</span>
                    <span className="block text-[12px] text-ink-400">{SECRET_HELP[name]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-ink-400">
              Only a tick or a circle is shown here. The keys themselves never leave Supabase.
            </p>
          </section>

          <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-ink-100">
            <h2 className="text-[15px] font-semibold text-ink-800">2. Webhook (paste into the Meta app)</h2>
            <p className="mt-1 text-[13px] text-ink-500">
              Meta app → WhatsApp → Configuration → Webhook. Paste the address below, and the same text you saved as
              WHATSAPP_VERIFY_TOKEN. Then subscribe to <strong>messages</strong> and{' '}
              <strong>smb_message_echoes</strong>.
            </p>
            <CopyBox label="Callback URL" value={status.webhookUrl} />
          </section>

          <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-ink-100">
            <h2 className="text-[15px] font-semibold text-ink-800">3. Message templates (create in Meta, category Utility)</h2>
            <p className="mt-1 text-[13px] text-ink-500">
              WhatsApp only lets us send a message 24 hours after the customer last wrote if it uses an approved
              template. Create these three in WhatsApp Manager → Message templates. Use the exact name, language{' '}
              <strong>{config.template_language}</strong>, and the text shown.
            </p>
            <CopyBox label="Template name" value={config.template_order_confirmed} />
            <CopyBox
              label="Body"
              value="Hi {{1}}, good news! Your Edelicacies order {{2}} has been approved. Total: {{3}}. Our team will send your payment details here shortly."
            />
            <CopyBox label="Template name" value={config.template_owner_alert} />
            <CopyBox
              label="Body"
              value={'Edelicacies alert: {{1}}. Customer said: "{{2}}". Open your dashboard inbox to reply.'}
            />
            <CopyBox label="Template name (category Authentication or Utility)" value={config.template_owner_code} />
            <CopyBox
              label="Body"
              value="Your Edelicacies verification code is {{1}}. It expires in 10 minutes. Do not share it."
            />
          </section>

          <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-ink-100">
            <h2 className="text-[15px] font-semibold text-ink-800">How it behaves</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-ink-600">
              <li>A customer writes to the number: the same assistant answers, with the same menu and rules.</li>
              <li>You reply from the WhatsApp Business app: the chat switches to You and the assistant stays quiet.</li>
              <li>Open the chat here and press Hand back to AI when you want the assistant to carry on.</li>
              <li>Photos and voice notes are passed to you, because the assistant reads text only.</li>
              <li>When you approve an order that began on WhatsApp, the customer is told in that chat.</li>
              <li>
                From a <strong>confirmed owner number</strong> (Owner Numbers page), messages to this number go to your
                private owner assistant instead: sales, menu, prices, phone orders and taking over chats. Anyone else,
                even someone claiming to be you, only ever gets the customer assistant.
              </li>
              <li>Risky changes ask for your PIN. Delete the PIN message from the chat afterwards.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
