import "server-only";
import * as cheerio from "cheerio";
import type { CourtRecord } from "./types";
import { cfmsDistrictValue, parseCaseHeading, parseCfmsDate, type CaseHeading } from "./cfms-parse";

// Scraper for the District Courts of Sindh case-flow system (CFMS). The pages
// are plain Laravel forms — no login, no CAPTCHA, results rendered server-side
// into a <table>. So instead of driving a headless browser we do what the
// browser does: GET a page (session cookies + hidden CSRF `_token`), POST the
// form fields, and parse the returned HTML.
//
// /advocatewise — every upcoming hearing for an advocate:
//   cnic    advocate CNIC, digits only ("4250142424244")
//   sbcno   advocate code ("ADVO-123-SBC-KHP")
//   The site asks for one or the other, not both.
//
// /case-search — every case matching a number; many cases can share one:
//   district, caseno, caseyear, firno, firyear, policeStation
//   courttype / casecategory are 0 for "all". An FIR search needs a specific
//   policeStation: with 0 ("All") it returns nothing.
//
// /case-profile — one case by its `casecode`: court, advocates, sections, and
//   its diary, newest first, where the top entry is the next hearing date.

const BASE_URL = "https://cases.districtcourtssindh.gos.pk";
const TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export class CfmsError extends Error {}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** One browser session: a cookie jar and the CSRF token that goes with it.
 *  Pass one in to make several lookups without opening a new session each. */
export class CfmsSession {
  private cookies = new Map<string, string>();
  private token = "";

  private absorb(res: Response) {
    for (const header of res.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  async request(path: string, body?: Record<string, string>): Promise<string> {
    let url = new URL(path, BASE_URL).toString();
    let init: RequestInit = body ? { method: "POST", body: new URLSearchParams(body) } : { method: "GET" };

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
          Accept: "text/html,application/xhtml+xml,application/json",
          Referer: `${BASE_URL}/case-search`,
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
      if (res.status === 419) throw new CfmsError("The court website rejected the session. Try again.");
      if (!res.ok) throw new CfmsError(`The court website responded with an error (HTTP ${res.status}).`);
      return res.text();
    }
    throw new CfmsError("The court website redirected too many times.");
  }

  /** POST a form, picking up the session token from its page the first time. */
  async post(path: string, fields: Record<string, string>): Promise<string> {
    if (!this.token) {
      const html = await this.request(path);
      const token = cheerio.load(html)('form input[name="_token"]').attr("value");
      if (!token) throw new CfmsError("Couldn't find the court website's form. Its layout may have changed.");
      this.token = token;
    }
    return this.request(path, { _token: this.token, ...fields });
  }
}

/** The results table, or an error if it's gone — so a page that changed layout
 *  or failed never reads as "no cases". */
function resultRows(html: string) {
  const $ = cheerio.load(html);
  if ($("table.table tbody").length === 0) {
    throw new CfmsError("Couldn't read the court website's results. Its layout may have changed.");
  }
  return { $, rows: $("table.table tbody tr").toArray() };
}

// ------------------------------------------------------------ advocate list --

export interface CauseListRow extends CaseHeading {
  /** The site's id for the case — what /case-profile takes. */
  caseCode: string | null;
  /** ISO date of the listed hearing. */
  hearingDate?: string;
  court: string;
  sections: string;
  advocateSide1: string;
  advocateSide2: string;
  firNo: string;
}

export interface CauseList {
  /** Advocate name the site prints in the "Daily list of …" heading. */
  advocateName: string;
  rows: CauseListRow[];
}

export type AdvocateQuery = { cnic: string } | { advocateCode: string };

/** Every upcoming hearing listed for an advocate, by CNIC or advocate code. */
export async function fetchCauseList(query: AdvocateQuery): Promise<CauseList> {
  const html = await new CfmsSession().post("/advocatewise", {
    cnic: "cnic" in query ? query.cnic.replace(/\D/g, "") : "",
    sbcno: "advocateCode" in query ? query.advocateCode : "",
  });

  const { $, rows } = resultRows(html);
  const parsed: CauseListRow[] = [];
  for (const tr of rows) {
    const cells = $(tr).children("td");
    if (cells.length < 7) continue; // "no records" rows and the like
    const cell = (i: number) => clean(cells.eq(i).text());
    // Cell 2 is the date in a <kbd>, then the court name.
    const dateText = clean(cells.eq(2).find("kbd").text());
    parsed.push({
      ...parseCaseHeading(cell(1)),
      caseCode: $(tr).find(".pview").first().attr("id")?.trim() || null,
      hearingDate: parseCfmsDate(dateText),
      court: cell(2).replace(dateText, "").trim(),
      sections: cell(3),
      advocateSide1: cell(4),
      advocateSide2: cell(5),
      firNo: cell(6),
    });
  }
  return { advocateName: clean($(".print-header h3 b").first().text()), rows: parsed };
}

// -------------------------------------------------------------- case search --

export interface CaseSearchResult extends CaseHeading {
  caseCode: string;
  court: string;
  /** As the site words it: "Pending (Instituted) 20/Dec/2024". */
  status: string;
  disposed: boolean;
  /** ISO date, when the status gives the date the case was instituted. */
  institutedOn?: string;
  /** ISO date of the next hearing, if the site has one. */
  hearingDate?: string;
}

export interface CaseSearchQuery {
  /** One of DISTRICTS' keys. */
  district: string;
  caseNo?: string;
  caseYear?: string;
  firNo?: string;
  firYear?: string;
  policeStation?: string;
}

export async function searchCases(query: CaseSearchQuery, session = new CfmsSession()): Promise<CaseSearchResult[]> {
  const district = cfmsDistrictValue(query.district);
  if (!district) throw new CfmsError("This district isn't on the court website.");

  const html = await session.post("/case-search", {
    district,
    caseno: query.caseNo ?? "",
    caseyear: query.caseYear ?? "",
    courttype: "0",
    casecategory: "0",
    policeStation: query.policeStation || "0",
    firno: query.firNo ?? "",
    firyear: query.firYear ?? "",
    pname: "",
  });

  const { $, rows } = resultRows(html);
  const results: CaseSearchResult[] = [];
  for (const tr of rows) {
    const cells = $(tr).children("td");
    const caseCode = $(tr).find(".pview").first().attr("id")?.trim();
    if (cells.length < 5 || !caseCode) continue;
    const cell = (i: number) => clean(cells.eq(i).text());
    const status = cell(3);
    results.push({
      ...parseCaseHeading(cell(1)),
      caseCode,
      court: cell(2),
      status,
      disposed: /^disposed/i.test(status),
      institutedOn: /instituted/i.test(status) ? parseCfmsDate(status) : undefined,
      hearingDate: parseCfmsDate(cell(4)),
    });
  }
  return results;
}

export interface PoliceStation {
  code: string;
  name: string;
}

/** A district's police stations, as the site's own form loads them. */
export async function fetchPoliceStations(districtKey: string): Promise<PoliceStation[]> {
  const district = cfmsDistrictValue(districtKey);
  if (!district) return [];
  const text = await new CfmsSession().request(`/loadPoliceStations/${district}`);
  try {
    const rows = JSON.parse(text) as { pscode: string | number; ps_name: string }[];
    return rows.map((r) => ({ code: String(r.pscode), name: clean(r.ps_name) }));
  } catch {
    throw new CfmsError("Couldn't read the police stations from the court website.");
  }
}

// ------------------------------------------------------------- case profile --

/** The site's "Case Profile" for a casecode from a search or the advocate list. */
export async function fetchCaseProfile(caseCode: string, session = new CfmsSession()): Promise<CourtRecord> {
  const html = await session.post("/case-profile", { casecode: caseCode });
  const $ = cheerio.load(html);

  // Detail rows are "label | value" or "label | value | label | value".
  const details = new Map<string, string>();
  $("tr").each((_, tr) => {
    const cells = $(tr).children("th, td").toArray();
    for (let i = 0; i + 1 < cells.length; i += 2) {
      if (cells[i].tagName === "th") details.set(clean($(cells[i]).text()).toLowerCase(), clean($(cells[i + 1]).text()));
    }
  });
  // An unknown code doesn't get an error: the site serves some other case (code
  // "0"). It prints the code it served, so check it, or a bad code could fill a
  // case with someone else's record.
  if (!details.get("case no") || clean($("small").first().text()) !== caseCode) {
    throw new CfmsError("Couldn't find this case on the court website.");
  }

  const diary: CourtRecord["diary"] = [];
  $("tr").each((_, tr) => {
    const date = parseCfmsDate(clean($(tr).find("kbd").text()));
    if (date) diary.push({ date, text: clean($(tr).children("td").eq(1).text()) });
  });

  return {
    court: details.get("court") ?? "",
    sections: details.get("under section") ?? "",
    advocate1: details.get("advocate 1") ?? "",
    advocate2: details.get("advocate 2") ?? "",
    diary,
  };
}
