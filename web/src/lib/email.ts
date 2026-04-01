import nodemailer from 'nodemailer'
import { DESTINATARIOS_DEFAULT } from '@/lib/email-config'

export { DESTINATARIOS_DEFAULT }

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const GMAIL_USER = process.env.GMAIL_USER ?? ''
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? ''

function crearTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface EnvioReporteParams {
  titulo: string
  periodo: string
  resumen: string
  pdfBase64: string
  destinatarios?: string[]
}

/**
 * Send a report via Gmail with the PDF attached.
 * Runs server-side only (API Route Handler).
 */
export async function enviarReportePorEmail(params: EnvioReporteParams): Promise<void> {
  const { titulo, periodo, resumen, pdfBase64, destinatarios = DESTINATARIOS_DEFAULT } = params

  const transporter = crearTransporter()
  const pdfBuffer = Buffer.from(pdfBase64, 'base64')

  await transporter.sendMail({
    from: `"Cruci-Track Sistema" <${GMAIL_USER}>`,
    to: destinatarios.join(', '),
    subject: `[CRUCI-TRACK] ${titulo} — ${periodo}`,
    html: buildEmailHTML(titulo, periodo, resumen),
    attachments: [
      {
        filename: `INFORME_${titulo.replace(/\s+/g, '_').toUpperCase()}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

/**
 * Send a test email to verify credentials and delivery.
 * Runs server-side only (API Route Handler).
 */
export async function enviarEmailPrueba(): Promise<void> {
  const transporter = crearTransporter()

  await transporter.sendMail({
    from: `"Cruci-Track Sistema" <${GMAIL_USER}>`,
    to: DESTINATARIOS_DEFAULT.join(', '),
    subject: '[CRUCI-TRACK] Verificación de Configuración de Correo',
    html: `
      <div style="font-family:Arial,sans-serif;background:#0F0F0F;color:#fff;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <div style="background:#DC2626;padding:20px;border-radius:8px;margin-bottom:24px;">
          <h1 style="margin:0;font-size:24px;font-weight:900;font-style:italic;letter-spacing:-1px;">CRUCI-TRACK</h1>
          <p style="margin:4px 0 0;font-size:11px;opacity:.8;letter-spacing:2px;">SISTEMA DE AUDITORÍA · CRUCIANELLI S.A.</p>
        </div>
        <h2 style="color:#22c55e;">Configuración de Email Verificada</h2>
        <p style="color:#aaa;">Este es un correo de prueba generado desde el sistema Cruci-Track para verificar que el envío automático de reportes está configurado correctamente.</p>
        <p style="color:#555;font-size:12px;border-top:1px solid #222;padding-top:16px;margin-top:24px;">
          Enviado: ${new Date().toLocaleString('es-AR')}<br>
          <span style="color:#333;">Documento generado automáticamente · Cruci-Track v2.1 · Crucianelli S.A.</span>
        </p>
      </div>
    `,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML template
// ─────────────────────────────────────────────────────────────────────────────

function buildEmailHTML(titulo: string, periodo: string, resumen: string): string {
  const lines = resumen.split('\n').map((line) => {
    const l = line.trim()
    if (!l) return '<br>'
    if (l.startsWith('ALERTA:'))
      return `<p style="color:#ef4444;font-weight:bold;margin:4px 0;">${l}</p>`
    if (l.startsWith('ESTADO ÓPTIMO:') || l.startsWith('ESTADO OPTIMO:'))
      return `<p style="color:#22c55e;font-weight:bold;margin:4px 0;">${l}</p>`
    if (l.startsWith('  ·') || l.startsWith('· '))
      return `<p style="color:#aaa;margin:2px 0 2px 16px;">${l}</p>`
    return `<p style="color:#ddd;margin:3px 0;">${l}</p>`
  }).join('')

  return `
    <div style="font-family:Arial,sans-serif;background:#0F0F0F;color:#fff;padding:40px;max-width:700px;margin:0 auto;border-radius:12px;">
      <div style="background:#DC2626;padding:24px;border-radius:8px;margin-bottom:32px;">
        <h1 style="margin:0;font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1px;">CRUCI-TRACK</h1>
        <p style="margin:4px 0 0;font-size:11px;opacity:.8;letter-spacing:2px;">SISTEMA DE AUDITORÍA DE TELEMETRÍA · CRUCIANELLI S.A.</p>
      </div>
      <h2 style="color:#fff;font-size:20px;font-weight:900;margin-bottom:4px;">${titulo.toUpperCase()}</h2>
      <p style="color:#666;font-size:12px;letter-spacing:1px;margin-bottom:28px;">${periodo}</p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:24px;margin-bottom:24px;">
        <h3 style="color:#DC2626;font-size:11px;letter-spacing:2px;margin:0 0 16px;text-transform:uppercase;">Resumen Ejecutivo</h3>
        ${lines}
      </div>
      <p style="color:#555;font-size:11px;border-top:1px solid #222;padding-top:16px;margin-top:24px;">
        El PDF oficial del informe se adjunta a este correo.<br>
        <span style="color:#333;">Documento generado automáticamente · Cruci-Track v2.1 · Crucianelli S.A.</span>
      </p>
    </div>
  `
}
