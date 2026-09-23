// deno-lint-ignore-file no-explicit-any
// Envío por SMTP (Gmail, puerto 465). Escrito a mano porque las librerías de Deno mandan
// los adjuntos en líneas sueltas sin esperar, y con pocos MB agotan la memoria de la función.

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface MailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface MailMessage {
  fromName?: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: MailAttachment[];
}

/** base64 por bloques de 57 bytes → líneas exactas de 76 caracteres */
function base64Lines(bytes: Uint8Array): string[] {
  const lines: string[] = [];
  const chunk = 57 * 1024;
  let rest = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const part = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    let bin = "";
    for (let j = 0; j < part.length; j += 8192) {
      bin += String.fromCharCode(...part.subarray(j, Math.min(j + 8192, part.length)));
    }
    rest += btoa(bin);
    while (rest.length >= 76) {
      lines.push(rest.slice(0, 76));
      rest = rest.slice(76);
    }
  }
  if (rest) lines.push(rest);
  return lines;
}

const base64Text = (s: string) => {
  const bytes = enc.encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
};

/** Asunto o nombre con acentos: =?UTF-8?B?...?= */
const encodeHeader = (s: string) =>
  /^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${base64Text(s)}?=`;

const sanitize = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

class SmtpConnection {
  private conn!: Deno.TlsConn;
  private buf = new Uint8Array(0);

  async connect(hostname: string, port: number) {
    this.conn = await Deno.connectTls({ hostname, port });
    await this.read(220);
  }

  close() {
    try { this.conn.close(); } catch { /* ya cerrada */ }
  }

  private async fill() {
    const chunk = new Uint8Array(4096);
    const n = await this.conn.read(chunk);
    if (n === null) throw new Error("SMTP: la conexión se cerró");
    const merged = new Uint8Array(this.buf.length + n);
    merged.set(this.buf);
    merged.set(chunk.subarray(0, n), this.buf.length);
    this.buf = merged;
  }

  private async readLine(): Promise<string> {
    while (true) {
      for (let i = 0; i < this.buf.length - 1; i++) {
        if (this.buf[i] === 13 && this.buf[i + 1] === 10) {
          const line = dec.decode(this.buf.subarray(0, i));
          this.buf = this.buf.subarray(i + 2);
          return line;
        }
      }
      await this.fill();
    }
  }

  /** Lee la respuesta completa (varias líneas con guion) y verifica el código */
  async read(expected: number): Promise<string> {
    let line = await this.readLine();
    let all = line;
    while (line[3] === "-") {
      line = await this.readLine();
      all += `\n${line}`;
    }
    const code = Number(all.slice(0, 3));
    if (code !== expected) throw new Error(`SMTP ${code}: ${all.slice(4, 200)}`);
    return all;
  }

  async write(data: string | Uint8Array) {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    let written = 0;
    while (written < bytes.length) written += await this.conn.write(bytes.subarray(written));
  }

  async cmd(command: string, expected: number, secret = false) {
    await this.write(`${command}\r\n`);
    try {
      return await this.read(expected);
    } catch (e) {
      throw new Error(secret ? `SMTP AUTH: ${e instanceof Error ? e.message : e}` : `${command.split(" ")[0]}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

/** Manda el email respondiendo dentro de un hilo. Los adjuntos van de a bloques. */
export async function sendMail(account: { user: string; pass: string }, msg: MailMessage) {
  const c = new SmtpConnection();
  await c.connect("smtp.gmail.com", 465);
  try {
    await c.cmd("EHLO dispatch-up.com", 250);
    await c.cmd("AUTH LOGIN", 334, true);
    await c.cmd(base64Text(account.user), 334, true);
    await c.cmd(base64Text(account.pass), 235, true);

    await c.cmd(`MAIL FROM:<${account.user}>`, 250);
    for (const rcpt of [...msg.to, ...(msg.cc ?? [])]) {
      await c.write(`RCPT TO:<${sanitize(rcpt)}>\r\n`);
      const line = await c.read(250).catch((e) => { throw new Error(`RCPT ${rcpt}: ${e.message}`); });
      void line;
    }
    await c.cmd("DATA", 354);

    const boundary = `dispatchup_${crypto.randomUUID()}`;
    const altBoundary = `alt_${crypto.randomUUID()}`;
    const from = msg.fromName ? `${encodeHeader(sanitize(msg.fromName))} <${account.user}>` : account.user;

    const headers = [
      `From: ${from}`,
      `To: ${msg.to.map(sanitize).join(", ")}`,
      ...(msg.cc && msg.cc.length > 0 ? [`Cc: ${msg.cc.map(sanitize).join(", ")}`] : []),
      `Subject: ${encodeHeader(sanitize(msg.subject))}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@dispatch-up.com>`,
      ...(msg.inReplyTo ? [`In-Reply-To: ${sanitize(msg.inReplyTo)}`] : []),
      ...(msg.references ? [`References: ${sanitize(msg.references)}`] : []),
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: base64",
      "",
      ...base64Lines(enc.encode(msg.text)),
      "",
      `--${altBoundary}`,
      'Content-Type: text/html; charset="utf-8"',
      "Content-Transfer-Encoding: base64",
      "",
      ...base64Lines(enc.encode(msg.html ?? msg.text)),
      "",
      `--${altBoundary}--`,
      "",
    ];
    await c.write(headers.join("\r\n") + "\r\n");

    for (const att of msg.attachments ?? []) {
      const name = sanitize(att.filename).replace(/"/g, "");
      await c.write(
        [
          `--${boundary}`,
          `Content-Type: ${att.contentType}; name="${name}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${name}"`,
          "",
          "",
        ].join("\r\n"),
      );
      // De a 200 líneas (unos 15 KB) para no acumular nada grande en memoria
      const lines = base64Lines(att.content);
      for (let i = 0; i < lines.length; i += 200) {
        await c.write(lines.slice(i, i + 200).join("\r\n") + "\r\n");
      }
    }

    await c.write(`--${boundary}--\r\n.\r\n`);
    await c.read(250);
    await c.cmd("QUIT", 221).catch(() => undefined);
  } finally {
    c.close();
  }
}
