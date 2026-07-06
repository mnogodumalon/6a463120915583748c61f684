// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Bewerbungen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    stelle?: string; // applookup -> URL zu 'Stellen' Record
    eingangsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    phase?: LookupValue;
    quelle?: LookupValue;
    bewerbungsunterlagen?: string;
    notizen?: string;
  };
}

export interface Stellen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    abteilung?: string;
    standort?: string;
    beschaeftigungsart?: LookupValue;
    status?: LookupValue;
    beschreibung?: string;
  };
}

export const APP_IDS = {
  BEWERBUNGEN: '6a46310b1bb742915f83d735',
  STELLEN: '6a463108ce8058178b7c0823',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'bewerbungen': {
    phase: [{ key: "eingegangen", label: "Eingegangen" }, { key: "screening", label: "Screening" }, { key: "gespraech_1", label: "1. Gespräch" }, { key: "gespraech_2", label: "2. Gespräch" }, { key: "angebot", label: "Angebot" }, { key: "abgelehnt", label: "Abgelehnt" }],
    quelle: [{ key: "eigene_website", label: "Eigene Website" }, { key: "linkedin", label: "LinkedIn" }, { key: "xing", label: "XING" }, { key: "indeed", label: "Indeed" }, { key: "stepstone", label: "StepStone" }, { key: "empfehlung", label: "Empfehlung" }, { key: "initiativ", label: "Initiativbewerbung" }, { key: "sonstige", label: "Sonstige" }],
  },
  'stellen': {
    beschaeftigungsart: [{ key: "vollzeit", label: "Vollzeit" }, { key: "teilzeit", label: "Teilzeit" }, { key: "minijob", label: "Minijob" }, { key: "praktikum", label: "Praktikum" }, { key: "werkstudent", label: "Werkstudent" }, { key: "freelance", label: "Freelance" }],
    status: [{ key: "offen", label: "Offen" }, { key: "besetzt", label: "Besetzt" }, { key: "pausiert", label: "Pausiert" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'bewerbungen': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'stelle': 'applookup/select',
    'eingangsdatum': 'date/date',
    'phase': 'lookup/select',
    'quelle': 'lookup/select',
    'bewerbungsunterlagen': 'file',
    'notizen': 'string/textarea',
  },
  'stellen': {
    'bezeichnung': 'string/text',
    'abteilung': 'string/text',
    'standort': 'string/text',
    'beschaeftigungsart': 'lookup/select',
    'status': 'lookup/radio',
    'beschreibung': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateBewerbungen = StripLookup<Bewerbungen['fields']>;
export type CreateStellen = StripLookup<Stellen['fields']>;