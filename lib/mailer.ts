/**
 * mailer.ts  (server-only)
 * Thin nodemailer wrapper. Sending is env-gated: until SMTP_* variables are
 * configured (Vercel → Project → Settings → Environment Variables), sends
 * no-op gracefully so the notification feature can ship ahead of SMTP setup.
 *
 * Required env:
 *   SMTP_HOST   e.g. smtp.office365.com / smtp.gmail.com / smtp-relay.brevo.com
 *   SMTP_PORT   e.g. 587
 *   SMTP_USER   mailbox / SMTP login
 *   SMTP_PASS   mailbox password / app password / SMTP key
 *   SMTP_FROM   sender, e.g. "Over-Sat CRM <crm@over-sat.com>" (defaults to SMTP_USER)
 */

import nodemailer from 'nodemailer'

export function mailerConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS)
}

/** Sends an email to the recipients. Returns false when SMTP isn't configured. */
export async function sendMail(to: string[], subject: string, html: string): Promise<boolean> {
  if (!mailerConfigured() || to.length === 0) return false

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: to.join(', '),
    subject,
    html,
  })
  return true
}

/** Minimal branded wrapper for notification bodies. */
export function emailShell(title: string, bodyHtml: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
    <h2 style="margin:0 0 4px;font-size:18px;color:#0f172a">Over-Sat CRM</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#9ca3af">${title}</p>
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:14px;line-height:1.6">
      ${bodyHtml}
    </div>
    <p style="margin:16px 0 0;font-size:11px;color:#9ca3af">
      Configure these notifications in Settings → Email Notifications.
      Over-Sat Proprietary &amp; Confidential.
    </p>
  </div>`
}
