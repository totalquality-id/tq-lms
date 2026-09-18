import "server-only";

/**
 * Pengiriman surel lewat Resend.
 *
 * API HTTP dipakai langsung, tanpa dependensi tambahan: yang dibutuhkan hanya
 * satu endpoint, dan pustaka SMTP akan membawa koneksi berumur panjang yang
 * tidak cocok dengan fungsi tanpa server.
 *
 * Bila `RESEND_API_KEY` atau `MAIL_FROM` tidak diisi, pengiriman tidak
 * dilakukan dan pemanggil diberi tahu lewat nilai kembaliannya. Antarmuka
 * kemudian mengatakan apa adanya — tautan undangan tetap ditampilkan untuk
 * diteruskan administrator — alih-alih melaporkan surel terkirim yang tidak
 * pernah ada.
 */

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export type Mail = {
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  action?: { label: string; url: string };
  footer?: string;
};

function render({ heading, lines, action, footer }: Mail) {
  const paragraphs = lines
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3d4757">${escape(line)}</p>`,
    )
    .join("");
  const button = action
    ? `<p style="margin:24px 0"><a href="${escape(action.url)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#2A2EB0;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escape(action.label)}</a></p>`
    : "";
  const note = footer
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#697687">${escape(footer)}</p>`
    : "";

  return `<!doctype html><html lang="id"><body style="margin:0;background:#f4f5f7;padding:24px;font-family:'Plus Jakarta Sans',Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e6eb;border-radius:8px">
<tr><td style="padding:28px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#697687">TQ Learning</p>
<h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;color:#1b2231">${escape(heading)}</h1>
${paragraphs}${button}${note}
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-size:11px;color:#8b95a4">PT Total Quality Indonesia · surel ini dikirim otomatis, mohon tidak dibalas.</p>
</body></html>`;
}

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plain({ heading, lines, action, footer }: Mail) {
  return [
    heading,
    "",
    ...lines,
    ...(action ? ["", `${action.label}: ${action.url}`] : []),
    ...(footer ? ["", footer] : []),
  ].join("\n");
}

/**
 * Mengirim satu surel. Tidak pernah melempar: surel adalah pemberitahuan atas
 * pekerjaan yang sudah selesai, dan penyedia yang sedang bermasalah tidak
 * boleh membatalkan penerbitan sertifikat atau penyimpanan nilai.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        html: render(mail),
        text: plain(mail),
      }),
    });
    if (!response.ok) {
      console.error(
        "mail: gagal dikirim",
        response.status,
        await response.text(),
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("mail: gagal dikirim", error);
    return false;
  }
}
