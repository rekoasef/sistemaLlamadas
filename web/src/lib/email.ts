import nodemailer from 'nodemailer'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const GMAIL_USER = process.env.GMAIL_USER ?? ''
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? ''

/**
 * Lista de mails separada por comas en una variable de entorno. Viven fuera del
 * repo (que es público). Falla explícito si falta, en vez de no mandar a nadie.
 */
function destinatariosDesdeEnv(nombre: 'REPORT_RECIPIENTS' | 'ALERT_RECIPIENTS'): string[] {
  const lista = (process.env[nombre] ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
  if (lista.length === 0) throw new Error(`[email] Falta la variable de entorno ${nombre}`)
  return lista
}

/** Hoy el sistema no manda mails: sin credenciales de Gmail, el envío se omite. */
export function emailConfigurado(): boolean {
  return Boolean(GMAIL_USER && GMAIL_PASS)
}

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
}

/**
 * Send a report via Gmail with the PDF attached, always to REPORT_RECIPIENTS.
 * Runs server-side only (API Route Handler).
 */
export async function enviarReportePorEmail(params: EnvioReporteParams): Promise<void> {
  const { titulo, periodo, resumen, pdfBase64 } = params

  const transporter = crearTransporter()
  const pdfBuffer = Buffer.from(pdfBase64, 'base64')

  await transporter.sendMail({
    from: `"Cruci-Track Sistema" <${GMAIL_USER}>`,
    to: destinatariosDesdeEnv('REPORT_RECIPIENTS').join(', '),
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

export interface AlertaTerminalParams {
  terminalId: string
  alias?: string
  statusPrevio: string | null
  statusNuevo: string
  timestamp: string
}

const ESTADO_LABEL: Record<string, string> = {
  ONLINE:       '🟢 En línea',
  OFFLINE:      '🔴 Sin conexión',
  SIN_PERMISOS: '⚠️ Sin permisos de llamadas',
}

function estadoLabel(s: string | null): string {
  return s ? (ESTADO_LABEL[s] ?? s) : 'Desconocido'
}

/**
 * Send a terminal status change alert email.
 * Runs server-side only (API Route Handler).
 */
export async function enviarAlertaTerminal(params: AlertaTerminalParams): Promise<void> {
  const { terminalId, alias, statusPrevio, statusNuevo, timestamp } = params
  const transporter = crearTransporter()
  const nombre = escapeHtml(alias ?? `Terminal ${terminalId}`)
  const fecha = new Date(timestamp).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

  const esGrave = statusNuevo === 'SIN_PERMISOS' || statusNuevo === 'OFFLINE'
  const accentColor = statusNuevo === 'SIN_PERMISOS' ? '#DC2626' : statusNuevo === 'OFFLINE' ? '#ca8a04' : '#22c55e'

  await transporter.sendMail({
    from: `"Cruci-Track Sistema" <${GMAIL_USER}>`,
    to: destinatariosDesdeEnv('ALERT_RECIPIENTS').join(', '),
    subject: `[CRUCI-TRACK] ${esGrave ? '⚠️ ALERTA' : 'INFO'} — ${alias ?? `Terminal ${terminalId}`} cambió a ${statusNuevo}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#0F0F0F;color:#fff;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <div style="background:#DC2626;padding:20px;border-radius:8px;margin-bottom:24px;">
          <h1 style="margin:0;font-size:24px;font-weight:900;font-style:italic;letter-spacing:-1px;">CRUCI-TRACK</h1>
          <p style="margin:4px 0 0;font-size:11px;opacity:.8;letter-spacing:2px;">SISTEMA DE AUDITORÍA · CRUCIANELLI S.A.</p>
        </div>
        <h2 style="color:${accentColor};font-size:18px;margin-bottom:4px;">Cambio de estado detectado</h2>
        <p style="color:#666;font-size:12px;margin-bottom:28px;">${fecha}</p>
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:24px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#555;font-size:11px;padding:6px 0;width:140px;">TERMINAL</td>
                <td style="color:#fff;font-weight:bold;">${nombre}</td></tr>
            <tr><td style="color:#555;font-size:11px;padding:6px 0;">ID</td>
                <td style="color:#aaa;font-family:monospace;font-size:12px;">${escapeHtml(terminalId)}</td></tr>
            <tr><td style="color:#555;font-size:11px;padding:6px 0;">ESTADO ANTERIOR</td>
                <td style="color:#aaa;">${escapeHtml(estadoLabel(statusPrevio))}</td></tr>
            <tr><td style="color:#555;font-size:11px;padding:6px 0;">ESTADO NUEVO</td>
                <td style="color:${accentColor};font-weight:bold;">${escapeHtml(estadoLabel(statusNuevo))}</td></tr>
          </table>
        </div>
        ${statusNuevo === 'SIN_PERMISOS' ? `
        <div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="color:#fca5a5;margin:0;font-size:13px;">
            <strong>Acción requerida:</strong> El usuario del dispositivo revocó los permisos de llamadas a la app Cruci-Track. Las llamadas <strong>no se están registrando</strong>. Contactar al responsable del terminal para restaurar los permisos.
          </p>
        </div>` : ''}
        ${statusNuevo === 'OFFLINE' ? `
        <div style="background:#422006;border:1px solid #78350f;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="color:#fcd34d;margin:0;font-size:13px;">
            <strong>Posibles causas:</strong> Sin conexión a internet, app desinstalada, teléfono apagado, o falla en la aplicación. Las llamadas <strong>no se están sincronizando</strong>.
          </p>
        </div>` : ''}
        <p style="color:#333;font-size:11px;border-top:1px solid #222;padding-top:16px;margin-top:24px;">
          Notificación automática · Cruci-Track · Crucianelli S.A.
        </p>
      </div>
    `,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML template
// ─────────────────────────────────────────────────────────────────────────────

/** Escapa texto para interpolarlo en HTML: los campos pueden venir del cliente o de la DB. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailHTML(titulo: string, periodo: string, resumen: string): string {
  const lines = resumen.split('\n').map((line) => {
    const raw = line.trim()
    if (!raw) return '<br>'
    const l = escapeHtml(raw)
    if (raw.startsWith('ALERTA:'))
      return `<p style="color:#ef4444;font-weight:bold;margin:4px 0;">${l}</p>`
    if (raw.startsWith('ESTADO ÓPTIMO:') || raw.startsWith('ESTADO OPTIMO:'))
      return `<p style="color:#22c55e;font-weight:bold;margin:4px 0;">${l}</p>`
    if (raw.startsWith('  ·') || raw.startsWith('· '))
      return `<p style="color:#aaa;margin:2px 0 2px 16px;">${l}</p>`
    return `<p style="color:#ddd;margin:3px 0;">${l}</p>`
  }).join('')

  return `
    <div style="font-family:Arial,sans-serif;background:#0F0F0F;color:#fff;padding:40px;max-width:700px;margin:0 auto;border-radius:12px;">
      <div style="background:#DC2626;padding:24px;border-radius:8px;margin-bottom:32px;">
        <h1 style="margin:0;font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1px;">CRUCI-TRACK</h1>
        <p style="margin:4px 0 0;font-size:11px;opacity:.8;letter-spacing:2px;">SISTEMA DE AUDITORÍA DE TELEMETRÍA · CRUCIANELLI S.A.</p>
      </div>
      <h2 style="color:#fff;font-size:20px;font-weight:900;margin-bottom:4px;">${escapeHtml(titulo.toUpperCase())}</h2>
      <p style="color:#666;font-size:12px;letter-spacing:1px;margin-bottom:28px;">${escapeHtml(periodo)}</p>
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
