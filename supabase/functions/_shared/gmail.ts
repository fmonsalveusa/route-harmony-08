// deno-lint-ignore-file no-explicit-any
// Gmail por IMAP (buscar hilos) y SMTP (responder dentro del hilo), con App Passwords.

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface GmailAccount {
  user: string;
  pass: string;
}

/** GMAIL_USER + las cuentas extra de BROKER_GMAIL_ACCOUNTS ("correo:apppassword,correo2:apppassword2") */
export function gmailAccounts(): GmailAccount[] {
  const list: GmailAccount[] = [];
  const add = (user: string, pass: string) => {
    const u = user.trim().toLowerCase();
    const p = pass.replace(/\s+/g, "");
    if (u && p && !list.some((a) => a.user === u)) list.push({ user: u, pass: p });
  };
  add(Deno.env.get("GMAIL_USER") ?? "", Deno.env.get("GMAIL_APP_PASSWORD") ?? "");
  for (const pair of (Deno.env.get("BROKER_GMAIL_ACCOUNTS") ?? "").split(/[,;\n]/)) {
    const i = pair.indexOf(":");
    if (i > 0) add(pair.slice(0, i), pair.slice(i + 1));
  }
  return list;
}

// ─── Cliente IMAP mínimo ───

interface ImapResponse {
  text: string;
  literals: string[];
}

const quote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

class ImapClient {
  private conn!: Deno.TlsConn;
  private buf = new Uint8Array(0);
  private tag = 0;

  async connect() {
    this.conn = await Deno.connectTls({ hostname: "imap.gmail.com", port: 993 });
    await this.readLine(); // saludo
  }

  close() {
    try { this.conn.close(); } catch { /* ya cerrada */ }
  }

  private async fill() {
    const chunk = new Uint8Array(65536);
    const n = await this.conn.read(chunk);
    if (n === null) throw new Error("IMAP: la conexión se cerró");
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

  private async readBytes(n: number): Promise<string> {
    while (this.buf.length < n) await this.fill();
    const s = dec.decode(this.buf.subarray(0, n));
    this.buf = this.buf.subarray(n);
    return s;
  }

  async cmd(command: string): Promise<ImapResponse[]> {
    const tag = `A${++this.tag}`;
    const data = enc.encode(`${tag} ${command}\r\n`);
    let written = 0;
    while (written < data.length) written += await this.conn.write(data.subarray(written));

    const out: ImapResponse[] = [];
    while (true) {
      let line = await this.readLine();
      if (line.startsWith(`${tag} `)) {
        if (!/^\S+ OK/i.test(line)) throw new Error(`IMAP ${command.split(" ")[0]}: ${line.slice(tag.length + 1)}`);
        return out;
      }
      const resp: ImapResponse = { text: "", literals: [] };
      while (true) {
        resp.text += line;
        const m = line.match(/\{(\d+)\}$/);
        if (!m) break;
        resp.literals.push(await this.readBytes(Number(m[1])));
        line = await this.readLine();
      }
      out.push(resp);
    }
  }

  /** Abre "Todos los correos" (el nombre cambia según el idioma de la cuenta) en solo lectura */
  async examineAllMail() {
    const list = await this.cmd('LIST "" "*"');
    const all = list.find((r) => /\\All\b/.test(r.text));
    let name = "[Gmail]/All Mail";
    if (all) {
      const m = all.text.match(/"((?:[^"\\]|\\.)*)"\s*$/) ?? all.text.match(/(\S+)\s*$/);
      if (m) name = m[1].replace(/\\(.)/g, "$1");
    }
    await this.cmd(`EXAMINE ${quote(name)}`);
  }

  async search(gmailQuery: string): Promise<number[]> {
    const res = await this.cmd(`UID SEARCH X-GM-RAW ${quote(gmailQuery)}`);
    return searchUids(res);
  }

  async threadUids(threadId: string): Promise<number[]> {
    const res = await this.cmd(`UID SEARCH X-GM-THRID ${threadId.replace(/\D/g, "")}`);
    return searchUids(res);
  }

  async headers(uids: number[]): Promise<MailHeader[]> {
    if (uids.length === 0) return [];
    const res = await this.cmd(
      `UID FETCH ${uids.join(",")} (UID X-GM-THRID BODY.PEEK[HEADER.FIELDS (MESSAGE-ID SUBJECT FROM TO CC REPLY-TO DATE REFERENCES)])`,
    );
    return res
      .filter((r) => /FETCH/i.test(r.text) && r.literals.length > 0)
      .map((r) => {
        const h = parseHeaders(r.literals[0]);
        return {
          uid: Number(r.text.match(/UID (\d+)/)?.[1] ?? 0),
          threadId: r.text.match(/X-GM-THRID (\d+)/)?.[1] ?? "",
          messageId: h["message-id"] ?? "",
          subject: decodeWords(h["subject"] ?? ""),
          from: decodeWords(h["from"] ?? ""),
          to: decodeWords(h["to"] ?? ""),
          cc: decodeWords(h["cc"] ?? ""),
          replyTo: decodeWords(h["reply-to"] ?? ""),
          date: h["date"] ?? "",
          references: h["references"] ?? "",
        };
      });
  }
}

function searchUids(res: ImapResponse[]): number[] {
  const line = res.find((r) => /^\* SEARCH/i.test(r.text));
  if (!line) return [];
  return line.text.replace(/^\* SEARCH/i, "").trim().split(/\s+/).filter(Boolean).map(Number).filter((n) => n > 0);
}

async function withImap<T>(acc: GmailAccount, fn: (c: ImapClient) => Promise<T>): Promise<T> {
  const c = new ImapClient();
  await c.connect();
  try {
    await c.cmd(`LOGIN ${quote(acc.user)} ${quote(acc.pass)}`);
    await c.examineAllMail();
    return await fn(c);
  } finally {
    try { await c.cmd("LOGOUT"); } catch { /* ignorar */ }
    c.close();
  }
}

// ─── Encabezados y direcciones ───

export interface MailHeader {
  uid: number;
  threadId: string;
  messageId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  replyTo: string;
  date: string;
  references: string;
}

function parseHeaders(raw: string): Record<string, string> {
  const h: Record<string, string> = {};
  for (const line of raw.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return h;
}

/** =?UTF-8?B?...?= / =?UTF-8?Q?...?= → texto */
function decodeWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=(\s+(?==\?))?/g, (match, charset: string, kind: string, text: string) => {
    try {
      let bytes: Uint8Array;
      if (kind.toUpperCase() === "B") {
        bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
      } else {
        const out: number[] = [];
        const t = text.replace(/_/g, " ");
        for (let i = 0; i < t.length; i++) {
          if (t[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
            out.push(parseInt(t.slice(i + 1, i + 3), 16));
            i += 2;
          } else out.push(t.charCodeAt(i));
        }
        bytes = new Uint8Array(out);
      }
      return new TextDecoder(charset.toLowerCase()).decode(bytes);
    } catch {
      return match;
    }
  });
}

export interface Address {
  name: string;
  email: string;
}

export function parseAddresses(s: string): Address[] {
  const parts: string[] = [];
  let cur = "";
  let inQuote = false;
  let inAngle = false;
  for (const ch of s) {
    if (ch === '"') inQuote = !inQuote;
    else if (ch === "<") inAngle = true;
    else if (ch === ">") inAngle = false;
    if (ch === "," && !inQuote && !inAngle) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);

  const out: Address[] = [];
  for (const p of parts) {
    const email = (p.match(/<([^>]+)>/)?.[1] ?? p.match(/[^\s<>"]+@[^\s<>"]+/)?.[0] ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    const name = p.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
    out.push({ name: name && !name.includes("@") ? name : "", email });
  }
  return out;
}

const dateOf = (m: MailHeader) => {
  const t = Date.parse(m.date);
  return Number.isNaN(t) ? 0 : t;
};

// ─── Búsqueda de hilos ───

export interface ThreadCandidate {
  account: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  messages: number;
}

async function searchAccount(acc: GmailAccount, query: string): Promise<ThreadCandidate[]> {
  return await withImap(acc, async (c) => {
    const uids = (await c.search(query)).slice(-60);
    const msgs = await c.headers(uids);
    const byThread = new Map<string, MailHeader[]>();
    for (const m of msgs) {
      if (!m.threadId) continue;
      byThread.set(m.threadId, [...(byThread.get(m.threadId) ?? []), m]);
    }
    return [...byThread.entries()].map(([threadId, list]) => {
      list.sort((a, b) => dateOf(a) - dateOf(b) || a.uid - b.uid);
      const first = list[0];
      const last = list[list.length - 1];
      const sender = parseAddresses(first.from)[0];
      return {
        account: acc.user,
        threadId,
        subject: first.subject,
        from: sender ? (sender.name ? `${sender.name} <${sender.email}>` : sender.email) : first.from,
        date: new Date(dateOf(last) || Date.now()).toISOString(),
        messages: list.length,
      };
    });
  });
}

/** Busca en todas las cuentas. Lanza error solo si ninguna cuenta respondió; los demás errores quedan en `errors`. */
export async function searchThreads(accounts: GmailAccount[], query: string, errors: string[] = []): Promise<ThreadCandidate[]> {
  const found: ThreadCandidate[] = [];
  const failed: string[] = [];
  for (const acc of accounts) {
    try {
      found.push(...(await searchAccount(acc, query)));
    } catch (e) {
      failed.push(`${acc.user}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  errors.push(...failed);
  if (failed.length > 0 && failed.length === accounts.length) throw new Error(failed.join(" | "));
  if (failed.length > 0) console.error("Gmail search errors:", failed);
  return found.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
}

/** Referencia apta para una búsqueda de Gmail */
export function cleanReference(ref: string | null | undefined): string {
  return (ref ?? "").replace(/[^A-Za-z0-9\-_./#]/g, "").trim();
}

/** Hilos donde el broker escribió con el número de carga: primero en el asunto, luego en cualquier parte */
export async function findLoadThreads(accounts: GmailAccount[], reference: string, errors: string[] = []): Promise<ThreadCandidate[]> {
  const ref = cleanReference(reference);
  if (ref.length < 3) return [];
  const bySubject = await searchThreads(accounts, `subject:"${ref}" -from:me newer_than:60d`, errors);
  if (bySubject.length > 0) return bySubject;
  errors.length = 0;
  return await searchThreads(accounts, `"${ref}" -from:me newer_than:60d`, errors);
}

// ─── Respuesta dentro del hilo ───

export interface ReplyTarget {
  subject: string;
  inReplyTo: string;
  references: string;
  to: string[];
  cc: string[];
}

/** Destinatarios y encabezados para "responder a todos" el último mensaje del broker en el hilo */
export async function replyTarget(acc: GmailAccount, threadId: string, ownEmails: string[]): Promise<ReplyTarget> {
  const msgs = await withImap(acc, async (c) => c.headers((await c.threadUids(threadId)).slice(-12)));
  if (msgs.length === 0) throw new Error("No se encontró el hilo en Gmail (¿se borró?)");
  msgs.sort((a, b) => dateOf(a) - dateOf(b) || a.uid - b.uid);

  const own = new Set(ownEmails.map((e) => e.toLowerCase()));
  const isOwn = (m: MailHeader) => parseAddresses(m.from).some((a) => own.has(a.email));
  const target = [...msgs].reverse().find((m) => !isOwn(m)) ?? msgs[msgs.length - 1];

  let to: Address[];
  let cc: Address[];
  if (isOwn(target)) {
    to = parseAddresses(target.to);
    cc = parseAddresses(target.cc);
  } else {
    to = parseAddresses(target.replyTo || target.from);
    cc = [...parseAddresses(target.to), ...parseAddresses(target.cc)];
  }

  const seen = new Set(own);
  const uniq = (list: Address[]) => list.map((a) => a.email).filter((e) => (seen.has(e) ? false : (seen.add(e), true)));
  const toList = uniq(to);
  const ccList = uniq(cc);
  if (toList.length === 0 && ccList.length > 0) toList.push(ccList.shift()!);
  if (toList.length === 0) throw new Error("El hilo no tiene destinatarios fuera de nuestras cuentas");

  const baseSubject = target.subject.replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, "");
  return {
    subject: `Re: ${baseSubject}`,
    inReplyTo: target.messageId,
    references: [...target.references.split(/\s+/).filter(Boolean).slice(-9), target.messageId].filter(Boolean).join(" "),
    to: toList,
    cc: ccList,
  };
}
