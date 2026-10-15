// Link previews (WhatsApp, Instagram, Facebook...) read the page's HTML without
// running JavaScript, so the /chat link needs its own preview tags in a real
// HTML file. After the build we copy dist/index.html to dist/chat/index.html
// and swap the title, description and URL. The app itself still loads normally.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const TITLE = 'Chat with Edelicacies: order food in minutes'
const DESCRIPTION =
  "Hungry? Chat with the Edelicacies assistant to see today's menu, ask questions and place your order in minutes. Fresh Nigerian dishes delivered across Uyo."
const URL = 'https://edelicacies.com/chat'

let html = readFileSync('dist/index.html', 'utf8')
const swap = (re, to) => {
  if (!re.test(html)) throw new Error('make-chat-page: tag not found: ' + re)
  html = html.replace(re, to)
}

swap(/<title>[\s\S]*?<\/title>/, `<title>${TITLE}</title>`)
swap(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${DESCRIPTION}$2`)
swap(/(<link rel="canonical" href=")[^"]*(")/, `$1${URL}$2`)
swap(/(<meta property="og:title" content=")[^"]*(")/, `$1${TITLE}$2`)
swap(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${DESCRIPTION}$2`)
swap(/(<meta property="og:url" content=")[^"]*(")/, `$1${URL}$2`)
swap(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${TITLE}$2`)
swap(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${DESCRIPTION}$2`)

mkdirSync('dist/chat', { recursive: true })
writeFileSync('dist/chat/index.html', html)
console.log('Wrote dist/chat/index.html')
