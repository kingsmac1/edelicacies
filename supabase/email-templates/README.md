# Login email templates (Supabase Auth)

Branded to match the order emails: red Edelicacies wordmark, white rounded card,
grey page, same footer. The login code is large and easy to copy.

Paste each file into **Supabase dashboard -> Authentication -> Emails -> Templates**.

| Template in Supabase | Body (paste this file) | Subject heading (paste this line) |
|---|---|---|
| **Confirm sign up** | `confirm-signup.html` | `confirm-signup.subject.txt` |
| **Magic link** | `magic-link.html` | `magic-link.subject.txt` |
| **Reset password** | `reset-password.html` | `reset-password.subject.txt` |
| **Change email address** | `change-email.html` | `change-email.subject.txt` |
| **Reauthentication** | `reauthentication.html` | `reauthentication.subject.txt` |

Notes
- `{{ .Token }}` is the 6-digit code, `{{ .ConfirmationURL }}` the button link and
  `{{ .NewEmail }}` the new address. Supabase fills these in. Do not change them.
- "Confirm sign up" is what NEW customers receive, "Magic link" what returning
  customers receive. Both show the code, because the website asks for a code.
- Use the template editor's **Source** (HTML) tab when pasting, then **Save**.
