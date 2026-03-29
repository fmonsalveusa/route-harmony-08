export type FieldType = "signature" | "name" | "date" | "address" | "notes" | "phone" | "email" | "initials" | "company" | "jobTitle" | "shortText" | "longText" | "dropdown" | "singleChoice" | "multipleChoice" | "number" | "checkbox";

export interface DocumentField {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
  label?: string;
  groupId?: string;
  required?: boolean;
  defaultValue?: string;
  options?: string[];
  addressRows?: 1 | 2;
}

export type DocumentStatus = "pending" | "signed" | "expired";

export interface SignTemplate {
  id: string;
  name: string;
  fileName: string;
  fileData: string;
  fields: DocumentField[];
  createdAt: number;
}

export interface SignDocument {
  id: string;
  fileName: string;
  fileData: string;
  signedFileData?: string;
  status: DocumentStatus;
  createdAt: number;
  signedAt?: number;
  expiresAt: number;
  fields: DocumentField[];
  signerData?: { name?: string; signatureImage?: string; date?: string };
  recipientEmail?: string;
}
