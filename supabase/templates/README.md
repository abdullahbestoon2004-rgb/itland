# Supabase Auth email templates

Emails the ITland apps (iOS and Android) send through Supabase Auth. Each one shows a short line in
English, Arabic and Kurdish (Sorani). The Kurdish lines came from Gemini (Antigravity CLI), as with all
Kurdish in this project. The code emails show only the 6-digit code `{{ .Token }}`. They have no links,
because the apps check the code themselves (`verifyOTP`). Plain HTML with inline CSS, no images.

| File | Dashboard template | Subject |
|---|---|---|
| `confirm_signup.html` | Authentication → Emails → Templates → **Confirm sign up** | `Your ITland code` |
| `recovery.html` | Authentication → Emails → Templates → **Reset password** | `Reset your ITland password` |
| `email_change.html` | Authentication → Emails → Templates → **Change email address** | `Confirm your email change` |
| `password_changed_notification.html` | Authentication → Emails → Security notifications → **Password changed** (turn it on) | `Your ITland password was changed` |

To install one: open the template in the dashboard, set the subject, open the message body source, paste the
whole file and save. Leave `{{ .Token }}` exactly as it is.

**Custom SMTP comes first.** The dashboard only lets you edit templates once custom SMTP is saved; until then
Supabase sends its default "Confirm your signup" email, which has a link and no code, so the apps' code screen
cannot be completed (seen on 10 Nov 2026). SMTP for this project: host `mail.itlandforcomputer.com`, port 465,
username and sender `info@itlandforcomputer.com`, sender name `ITland`, password = that mailbox's password.
Custom SMTP was saved and `confirm_signup.html`, `recovery.html` and `email_change.html` were installed (with the
subjects above) on 10 Nov 2026. The password-changed notification is not turned on yet.

## Settings these emails need

- Authentication → Sign In / Providers → Email: **Confirm email** on, and the **email OTP length** set to 6
  digits, because the apps' code field takes 6 digits.
- **Custom SMTP** (Authentication → Emails → SMTP settings). Supabase's built-in sender only delivers to the
  project team's own addresses and sends very few emails an hour, so customers will not get their codes
  without it. Use a sender on the store's domain, for example `info@itlandforcomputer.com`, and set the sender
  name to `ITland`.
- The password-changed email has no code. If the customer did not change the password, it tells them to
  reset it in the app and contact the store on WhatsApp, instead of "ignore this email".
- The apps show the account email as read-only today, so `email_change.html` is only sent if changing the
  email is added later. With **Secure email change** on, Supabase sends a code to both the old and the new
  address. The wording does not say which address it is, so the same template works for both.
- Magic link, Invite user and Reauthentication are not used by the apps.

## If Auth is ever managed with the Supabase CLI

```toml
[auth.email.template.confirmation]
subject = "Your ITland code"
content_path = "./supabase/templates/confirm_signup.html"

[auth.email.template.recovery]
subject = "Reset your ITland password"
content_path = "./supabase/templates/recovery.html"

[auth.email.template.email_change]
subject = "Confirm your email change"
content_path = "./supabase/templates/email_change.html"

[auth.email.notification.password_changed]
enabled = true
subject = "Your ITland password was changed"
content_path = "./supabase/templates/password_changed_notification.html"
```
