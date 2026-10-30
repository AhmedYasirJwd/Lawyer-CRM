"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle, WifiOff } from "lucide-react";
import type { CaseStatus, LegalCase, Priority, PartySide, RelationType } from "@/lib/types";
import { CASE_ROLES, CASE_TYPES, CASE_STAGES, RELATION_TYPES } from "@/lib/types";
import { Autocomplete } from "./Autocomplete";
import { KARACHI_COURTS } from "@/lib/karachi-courts";
import { saveCase } from "@/lib/case-sync";

const STATUSES: CaseStatus[] = ["Active", "Pending", "Closed", "Disposed"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const STAGES = CASE_STAGES;
const PARTY_1_ROLES = [
  "Plaintiff",
  "Petitioner",
  "Applicant",
  "Appellant",
  "Revisionist",
  "Complainant",
  "Private Complainant",
  "Claimant",
  "Objector",
  "Intervenor / Intervener",
  "Aggrieved Person",
  "Victim / Aggrieved Person",
  "Decree Holder",
  "Auction Purchaser",
  "Creditor",
  "Bank / Financial Institution",
  "Taxpayer",
  "Guardian",
  "Third Party",
  "Convict / Appellant",
  "State",
  "Prosecution",
  "Other",
];
const PARTY_2_ROLES = [
  "Defendant",
  "Respondent",
  "Respondent in Appeal",
  "Respondent in Revision",
  "Opposite Party",
  "Accused",
  "State",
  "Federation",
  "Province",
  "Government Department",
  "Government Authority",
  "Regulatory Authority",
  "Creditor",
  "Bank / Financial Institution",
  "Borrower / Customer",
  "Department / Authority",
  "Third Party",
  "Other",
];
function rolesForSide(side: PartySide): string[] {
  return side === 1 ? PARTY_1_ROLES : PARTY_2_ROLES;
}

interface PartyDraft {
  key: string;
  side: PartySide;
  name: string;
  role: string;
  phone: string;
  cnic: string;
  address: string;
  relationType: RelationType | "";
  relationName: string;
}

/** Names on one side, joined for the auto-filled case title — e.g. two
 *  co-plaintiffs read as "Ali Khan & Zubair Khan" rather than just the first. */
function sideNameLine(parties: PartyDraft[], side: PartySide): string {
  return parties
    .filter((p) => p.side === side)
    .map((p) => p.name.trim())
    .filter(Boolean)
    .join(" & ");
}

function autoTitle(parties: PartyDraft[]): string {
  const p1 = sideNameLine(parties, 1);
  const p2 = sideNameLine(parties, 2);
  return p1 && p2 ? `${p1} vs ${p2}` : p1 || p2 || "";
}

function Field({
  label,
  error,
  children,
  name,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  /** Marks the field so a failed submit can scroll straight to it — see
   *  scrollToFirstError in CaseForm. Only needed on fields that block saving. */
  name?: string;
}) {
  return (
    <label className="block" data-field={name}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error && (
        <span className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={12} />
          {error}
        </span>
      )}
    </label>
  );
}

const REQUIRED_FIELD_ORDER: Array<keyof FieldErrors> = ["caseNumber", "title", "court", "filingDate"];

/** Jumps to and focuses the first invalid required field, so the person
 *  never has to hunt for what's blocking save — the page does it for them. */
function scrollToFirstError(errors: FieldErrors) {
  const firstKey = REQUIRED_FIELD_ORDER.find((k) => errors[k]);
  if (!firstKey) return;
  const el = document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.querySelector<HTMLElement>("input, textarea, select")?.focus();
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";
const inputErrorClass =
  "w-full rounded-xl border border-red-400 bg-red-50/40 px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

function emptyParty(side: PartySide, role: string = "Other"): PartyDraft {
  return {
    key: crypto.randomUUID(),
    side,
    name: "",
    role,
    phone: "",
    cnic: "",
    address: "",
    relationType: "",
    relationName: "",
  };
}

interface FieldErrors {
  caseNumber?: string;
  title?: string;
  court?: string;
  filingDate?: string;
}

function validateForm(form: {
  caseNumber: string;
  title: string;
  court: string;
  filingDate: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.caseNumber.trim()) errors.caseNumber = "Case number is required.";
  if (!form.title.trim()) errors.title = "Case title is required.";
  if (!form.court.trim()) errors.court = "Court is required.";
  if (!form.filingDate) {
    errors.filingDate = "Filing date is required.";
  } else if (Number.isNaN(new Date(form.filingDate).getTime())) {
    errors.filingDate = "That doesn't look like a valid date.";
  }
  return errors;
}

// Loose on purpose — just enough to catch "clearly not a phone number", not
// to enforce a specific country format.
const PHONE_RE = /^[0-9+()\-\s]{7,}$/;
// Pakistani CNIC, with or without the dashes: 12345-1234567-1 or 1234512345671.
const CNIC_RE = /^\d{5}-?\d{7}-?\d{1}$/;

function validateParty(p: PartyDraft): { phone?: string; cnic?: string } {
  const errors: { phone?: string; cnic?: string } = {};
  if (p.phone.trim() && !PHONE_RE.test(p.phone.trim())) errors.phone = "Doesn't look like a valid phone number.";
  if (p.cnic.trim() && !CNIC_RE.test(p.cnic.trim())) errors.cnic = "Doesn't look like a valid CNIC (e.g. 42101-1234567-1).";
  return errors;
}

export function CaseForm({ initial }: { initial?: LegalCase }) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOfflineNotice, setSavedOfflineNotice] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, boolean>>>({});

  // A create's id is decided up front (not by the server) so the case can
  // be saved to the device and opened immediately, online or off — see
  // src/lib/case-sync.ts.
  const idRef = useRef(initial?.id ?? crypto.randomUUID());

  const [formState, setForm] = useState({
    caseNumber: initial?.caseNumber ?? "",
    title: initial?.title ?? "",
    court: initial?.court ?? "",
    filingDate: initial?.filingDate ?? new Date().toISOString().slice(0, 10),
    caseType: initial?.caseType ?? CASE_TYPES[0],
    counselFor: initial?.counselFor ?? CASE_ROLES[0],
    stage: initial?.stage ?? STAGES[0],
    status: initial?.status ?? "Active",
    priority: initial?.priority ?? "Medium",
  });

  const [parties, setParties] = useState<PartyDraft[]>(
    initial?.parties && initial.parties.length > 0
      ? initial.parties.map((p) => ({
          key: p.id,
          side: p.side ?? 1,
          name: p.name,
          role: p.role,
          phone: p.phone ?? "",
          cnic: p.cnic ?? "",
          address: p.address ?? "",
          relationType: p.relationType ?? "",
          relationName: p.relationName ?? "",
        }))
      : [emptyParty(1, "Plaintiff"), emptyParty(2, "Defendant")]
  );
  const [partyTouched, setPartyTouched] = useState<Record<string, { phone?: boolean; cnic?: boolean }>>({});

  // The case title auto-fills as "{Party 1 side} vs {Party 2 side}" (each
  // side's names joined with "&" when more than one person is on it) while
  // the title is still following that pattern. On create that's always true
  // at first. On edit, we only keep auto-syncing if the saved title still
  // matches what the saved parties would produce — i.e. nobody has
  // deliberately customized it away from the default. A hand-written title
  // (e.g. "Estate of X v. Bank") is left alone so editing a party's phone
  // number doesn't clobber it.
  const [titleTouched, setTitleTouched] = useState(() => {
    if (!initial) return false;
    const initialDrafts: PartyDraft[] = initial.parties.map((p) => ({
      key: p.id,
      side: p.side ?? 1,
      name: p.name,
      role: p.role,
      phone: "",
      cnic: "",
      address: "",
      relationType: "",
      relationName: "",
    }));
    return initial.title !== autoTitle(initialDrafts);
  });
  // While untouched, the title is derived from the parties on every render
  // rather than copied into state by an effect.
  const form = useMemo(
    () => (titleTouched ? formState : { ...formState, title: autoTitle(parties) }),
    [formState, parties, titleTouched]
  );

  const fieldErrors = useMemo(() => validateForm(form), [form]);
  const partyErrors = useMemo(() => {
    const map: Record<string, { phone?: string; cnic?: string }> = {};
    for (const p of parties) map[p.key] = validateParty(p);
    return map;
  }, [parties]);
  // Party phone/CNIC are shown as inline warnings but never block saving —
  // only the four required case fields do. Blocking on a legacy phone
  // number someone didn't even touch (while editing an old case) is exactly
  // the kind of "why won't this just save" friction to avoid.
  const isValid = Object.keys(fieldErrors).length === 0;

  // Show a field's error once the person has left it (or after a submit
  // attempt surfaces everything at once) — not before they've had a chance
  // to type into it.
  function shown<K extends keyof FieldErrors>(key: K): string | undefined {
    return (touched[key] || attemptedSubmit) ? fieldErrors[key] : undefined;
  }
  function partyShown(key: string, field: "phone" | "cnic"): string | undefined {
    return (partyTouched[key]?.[field] || attemptedSubmit) ? partyErrors[key]?.[field] : undefined;
  }


  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Preserve a legacy counsel-for value (e.g. an old judge's name) as a selectable
  // option if it doesn't match the current role list, so editing an old case
  // doesn't silently overwrite it.
  const counselForOptions =
    form.counselFor && !CASE_ROLES.includes(form.counselFor)
      ? [form.counselFor, ...CASE_ROLES]
      : CASE_ROLES;

  function updateParty<K extends keyof PartyDraft>(key: string, field: K, value: PartyDraft[K]) {
    setParties((ps) => ps.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  }

  function addParty(side: PartySide) {
    setParties((ps) => [...ps, emptyParty(side, "Other")]);
  }

  function removeParty(key: string) {
    setParties((ps) => ps.filter((p) => p.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttemptedSubmit(true);
    setError(null);
    setSavedOfflineNotice(false);

    if (!isValid) {
      // No network round-trip wasted on a request that would just fail the
      // same checks server-side — instead jump straight to what's wrong so
      // the person doesn't have to scan the whole form looking for it.
      scrollToFirstError(fieldErrors);
      return;
    }

    setSubmitting(true);

    const partiesPayload = parties
      .filter((p) => p.name.trim())
      .map((p) => ({
        id: crypto.randomUUID(),
        side: p.side,
        name: p.name.trim(),
        role: p.role,
        phone: p.phone.trim() || undefined,
        cnic: p.cnic.trim() || undefined,
        address: p.address.trim() || undefined,
        relationType: p.relationType || undefined,
        relationName: p.relationName.trim() || undefined,
      }));

    const payload = {
      id: idRef.current,
      caseNumber: form.caseNumber.trim(),
      title: form.title.trim(),
      court: form.court.trim(),
      filingDate: form.filingDate,
      caseType: form.caseType,
      counselFor: form.counselFor,
      stage: form.stage,
      status: form.status,
      priority: form.priority,
      parties: partiesPayload,
    };

    const localCase: LegalCase = {
      id: idRef.current,
      caseNumber: payload.caseNumber,
      title: payload.title,
      court: payload.court,
      filingDate: payload.filingDate,
      caseType: payload.caseType,
      counselFor: payload.counselFor,
      stage: payload.stage,
      status: payload.status,
      priority: payload.priority,
      lastUpdated: new Date().toISOString(),
      parties: partiesPayload,
      timeline: initial?.timeline ?? [
        {
          id: crypto.randomUUID(),
          title: "Case Filed",
          date: payload.filingDate,
          description: `Case has been filed in ${payload.court}.`,
          type: "filed",
        },
      ],
      notes: initial?.notes,
    };

    const result = await saveCase(localCase, isEdit ? "update" : "create", payload);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    if (!result.synced) setSavedOfflineNotice(true);
    // Hard navigation, not router.push: the case detail page is one of the
    // offline-enabled routes (see public/sw.js), and only a real navigation
    // is guaranteed to be caught by the service worker when there's no
    // network. router.push's client-side RSC fetch is a plain network
    // request the service worker doesn't intercept, so right after saving
    // offline it could fail silently and strand the person on the form —
    // even though the case itself was already saved to the device.
    window.location.href = `/cases/${idRef.current}`;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {attemptedSubmit && !isValid && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            {Object.keys(fieldErrors).length === 1
              ? "One field needs your attention — it's highlighted below."
              : `${Object.keys(fieldErrors).length} fields need your attention — they're highlighted below.`}{" "}
            <button
              type="button"
              onClick={() => scrollToFirstError(fieldErrors)}
              className="font-semibold underline underline-offset-2"
            >
              Take me there
            </button>
          </span>
        </p>
      )}
      {savedOfflineNotice && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <WifiOff size={16} className="mt-0.5 shrink-0" />
          Saved on this device. It&apos;ll sync automatically once you&apos;re back online.
        </p>
      )}

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink">Case Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Case Number" name="caseNumber" error={shown("caseNumber")}>
            <input
              required
              className={shown("caseNumber") ? inputErrorClass : inputClass}
              placeholder="e.g. 123/2025"
              value={form.caseNumber}
              onChange={(e) => set("caseNumber", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, caseNumber: true }))}
            />
          </Field>
          <Field label="Case Type">
            <Autocomplete
              required
              placeholder="Start typing to search case types..."
              value={form.caseType}
              onChange={(v) => set("caseType", v)}
              options={CASE_TYPES}
            />
          </Field>
          <Field label="Case Title (e.g. Party vs Party)" name="title" error={shown("title")}>
            <input
              required
              className={shown("title") ? inputErrorClass : inputClass}
              placeholder="Ali Khan vs Ahmed & Co."
              value={form.title}
              onChange={(e) => {
                setTitleTouched(true);
                set("title", e.target.value);
              }}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            />
            <p className="mt-1 text-xs text-faint">
              {titleTouched ? (
                <>
                  Editing manually.{" "}
                  <button
                    type="button"
                    onClick={() => setTitleTouched(false)}
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    Auto-fill from parties instead
                  </button>
                </>
              ) : (
                "Auto-filled from Party 1 vs Party 2 below — edit anytime."
              )}
            </p>
          </Field>
          <Field label="Court" name="court" error={shown("court")}>
            <Autocomplete
              required
              placeholder="Start typing to search Karachi courts..."
              value={form.court}
              onChange={(v) => {
                set("court", v);
                setTouched((t) => ({ ...t, court: true }));
              }}
              options={KARACHI_COURTS}
            />
          </Field>
          <Field label="Counsel For">
            <Autocomplete
              placeholder="Start typing to search roles..."
              value={form.counselFor}
              onChange={(v) => set("counselFor", v)}
              options={counselForOptions}
            />
          </Field>
          <Field label="Filing Date" name="filingDate" error={shown("filingDate")}>
            <input
              required
              type="date"
              className={shown("filingDate") ? inputErrorClass : inputClass}
              value={form.filingDate}
              onChange={(e) => set("filingDate", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, filingDate: true }))}
            />
          </Field>
          <Field label="Case Stage">
            <Autocomplete
              required
              placeholder="Start typing to search case stages..."
              value={form.stage}
              onChange={(v) => set("stage", v)}
              options={STAGES}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => set("status", e.target.value as CaseStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                className={inputClass}
                value={form.priority}
                onChange={(e) => set("priority", e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {([1, 2] as const).map((side) => {
        const sideParties = parties.filter((p) => p.side === side);
        return (
          <div key={side} className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">
                Party {side}
                <span className="ml-1.5 text-xs font-normal text-faint">
                  {side === 1 ? "— initiating / relief-seeking" : "— adverse / responding"}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => addParty(side)}
                className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <Plus size={15} />
                Add Person
              </button>
            </div>

            {sideParties.length === 0 ? (
              <p className="text-sm text-muted">No one added to this side yet.</p>
            ) : (
              <div className="space-y-4">
                {sideParties.map((p, i) => (
                  <div key={p.key} className="rounded-xl border border-line p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-faint">
                        {sideParties.length > 1 ? `Person ${i + 1}` : "Details"}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeParty(p.key)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-faint hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove person"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Name">
                        <input
                          className={inputClass}
                          value={p.name}
                          onChange={(e) => updateParty(p.key, "name", e.target.value)}
                        />
                      </Field>
                      <Field label="Role">
                        <Autocomplete
                          placeholder="Start typing to search roles..."
                          value={p.role}
                          onChange={(v) => updateParty(p.key, "role", v)}
                          options={rolesForSide(side)}
                        />
                      </Field>
                      <Field label="Relation">
                        <div className="flex gap-2">
                          <select
                            className={`${inputClass} shrink-0 basis-36`}
                            value={p.relationType}
                            onChange={(e) => updateParty(p.key, "relationType", e.target.value as RelationType | "")}
                          >
                            <option value="">— None —</option>
                            {RELATION_TYPES.map((rt) => (
                              <option key={rt} value={rt}>
                                {rt}
                              </option>
                            ))}
                          </select>
                          <input
                            className={inputClass}
                            placeholder="Relative's name"
                            value={p.relationName}
                            onChange={(e) => updateParty(p.key, "relationName", e.target.value)}
                            disabled={!p.relationType}
                          />
                        </div>
                      </Field>
                      <Field label="CNIC" error={partyShown(p.key, "cnic")}>
                        <input
                          className={partyShown(p.key, "cnic") ? inputErrorClass : inputClass}
                          placeholder="42101-1234567-1"
                          value={p.cnic}
                          onChange={(e) => updateParty(p.key, "cnic", e.target.value)}
                          onBlur={() => setPartyTouched((t) => ({ ...t, [p.key]: { ...t[p.key], cnic: true } }))}
                        />
                      </Field>
                      <Field label="Phone" error={partyShown(p.key, "phone")}>
                        <input
                          className={partyShown(p.key, "phone") ? inputErrorClass : inputClass}
                          value={p.phone}
                          onChange={(e) => updateParty(p.key, "phone", e.target.value)}
                          onBlur={() =>
                            setPartyTouched((t) => ({ ...t, [p.key]: { ...t[p.key], phone: true } }))
                          }
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Address">
                          <input
                            className={inputClass}
                            value={p.address}
                            onChange={(e) => updateParty(p.key, "address", e.target.value)}
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-background"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || (attemptedSubmit && !isValid)}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Case"}
        </button>
      </div>
    </form>
  );
}
