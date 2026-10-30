import "server-only";
import * as cheerio from "cheerio";

// Scraper for the District Courts of Sindh case-flow system (CFMS):
// https://cases.districtcourtssindh.gos.pk/advocatewise
//
// The page is a plain Laravel form — no login, no CAPTCHA, results rendered
// server-side into a <table>. So instead of driving a headless browser we do
// what the browser does: GET the page (session cookies + hidden CSRF
// `_token`), POST the form fields, and parse the returned HTML.
//
// Form fields (as of 2026-10):
//   _token  hidden CSRF token, tied to the `cfms_dc_session` cookie
//   cnic    advocate CNIC, digits only ("4250142424244")
//   sbcno   advocate code ("ADVO-123-SBC-KHP")
// The site asks for one or the other, not both.

const BASE_URL = "https://cases.districtcourtssindh.gos.pk";
const TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export interface CauseListRow {
  serial: string;
  caseNo: string;
  /** CFMS's internal id for the case — what /case-profile takes. */
  caseCode: string | null;
  hearingStatus: string;
  sections: string;
  advocateSide1: string;
  advocateSide2: string;
  firNo: string;
}

export interface CauseList {
  /** Advocate name CFMS prints in the "Daily list of …" heading. The list is
   *  always today's — the site has no date picker. */
  advocateName: string;
  rows: CauseListRow[];
}

export type AdvocateQuery = { cnic: string } | { advocateCode: string };

export class CfmsError extends Error {}

/** Minimal cookie jar: name → value, updated from each response. */
class Session {
  private cookies = new Map<string, string>();
  token = "";

  private absorb(res: Response) {
    for (const header of res.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  async request(path: string, body?: Record<string, string>): Promise<string> {
    let url = new URL(path, BASE_URL).toString();
    let init: RequestInit = body
      ? { method: "POST", body: new URLSearchParams(body) }
      : { method: "GET" };

    // Follow redirects by hand so cookies set on a 302 (Laravel does this on
    // validation errors) aren't lost.
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(url, {
        ...init,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          Referer: `${BASE_URL}/advocatewise`,
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(init.method === "POST" && { "Content-Type": "application/x-www-form-urlencoded" }),
        },
      });
      this.absorb(res);

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url).toString();
        init = { method: "GET" };
        continue;
      }
      if (res.status === 419) throw new CfmsError("CFMS rejected the session token (419).");
      if (!res.ok) throw new CfmsError(`CFMS responded with HTTP ${res.status}.`);
      return res.text();
    }
    throw new CfmsError("CFMS redirected too many times.");
  }

  async open() {
    const html = await this.request("/advocatewise");
    const token = cheerio.load(html)('form input[name="_token"]').attr("value");
    if (!token) throw new CfmsError("Couldn't find the CFMS search form — the page layout may have changed.");
    this.token = token;
  }
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function parseCauseList(html: string): CauseList {
  const $ = cheerio.load(html);
  const advocateName = clean($(".print-header h3 b").first().text());

  const rows: CauseListRow[] = [];
  $("table.table tbody tr").each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length < 7) return; // "no records" rows and the like
    const cell = (i: number) => clean(cells.eq(i).text());
    // The case number links to its profile modal: <… class="pview" id="{casecode}">
    const caseCode = $(tr).find(".pview").first().attr("id")?.trim() || null;
    rows.push({
      serial: cell(0),
      caseNo: cell(1),
      caseCode,
      hearingStatus: cell(2),
      sections: cell(3),
      advocateSide1: cell(4),
      advocateSide2: cell(5),
      firNo: cell(6),
    });
  });

  return { advocateName, rows };
}

/** The advocate's daily cause list, looked up by CNIC or advocate code. */
export async function fetchCauseList(query: AdvocateQuery): Promise<CauseList> {
  const session = new Session();
  await session.open();
  const html = await session.request("/advocatewise", {
    _token: session.token,
    cnic: "cnic" in query ? query.cnic.replace(/\D/g, "") : "",
    sbcno: "advocateCode" in query ? query.advocateCode : "",
  });
  return parseCauseList(html);
}

export interface CaseProfile {
  /** Label → value pairs pulled from the profile's tables. */
  fields: { label: string; value: string }[];
  /** Plain-text fallback for anything not laid out as label/value. */
  text: string;
}

/** The "Case Profile" modal content for a casecode from the cause list. */
export async function fetchCaseProfile(caseCode: string): Promise<CaseProfile> {
  const session = new Session();
  await session.open();
  const html = await session.request("/case-profile", { _token: session.token, casecode: caseCode });
  const $ = cheerio.load(html);

  const fields: CaseProfile["fields"] = [];
  $("tr").each((_, tr) => {
    const cells = $(tr).children("th, td").toArray().map((c) => clean($(c).text()));
    // Rows are either "label | value" or "label | value | label | value".
    for (let i = 0; i + 1 < cells.length; i += 2) {
      if (cells[i]) fields.push({ label: cells[i].replace(/:$/, ""), value: cells[i + 1] });
    }
  });

  return { fields, text: clean($.root().text()) };
}
