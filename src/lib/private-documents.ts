import { supabase } from "@/integrations/supabase/client";
import { workflowRpc } from "@/lib/workflow";

export type PrivateEntityType = "organization" | "battery" | "collection" | "lot" | "operation";
export type PrivateDocument = {
  id: string;
  document_type: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string;
  status: string;
  validated_at: string | null;
};

type Reservation = { document_id: string; bucket: string; path: string; max_size: number };
type Access = {
  id: string;
  bucket: string;
  path: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
};
type Finalized = { id: string; status: string; bucket: string; path: string };

const allowedExtensions = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "csv",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function validatePrivateFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions.has(extension)) throw new Error("Extensão não permitida");
  if (!allowedMimeTypes.has(file.type)) throw new Error("Tipo de arquivo não permitido");
  if (file.size <= 0 || file.size > 15 * 1024 * 1024)
    throw new Error("O arquivo deve ter no máximo 15 MB");
}

export async function uploadPrivateDocument(
  entityType: PrivateEntityType,
  entityId: string,
  documentType: string,
  file: File,
) {
  validatePrivateFile(file);
  const reservation = await workflowRpc<Reservation>("prepare_private_document_upload", {
    _entity_type: entityType,
    _entity_id: entityId,
    _document_type: documentType,
    _file_name: file.name,
    _mime_type: file.type,
    _size_bytes: file.size,
  });
  if (!reservation) throw new Error("Não foi possível reservar o upload");
  const { error } = await supabase.storage.from(reservation.bucket).upload(reservation.path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return workflowRpc<Finalized>("finalize_private_document_upload", {
    _document_id: reservation.document_id,
  });
}

export async function listPrivateDocuments(entityType: PrivateEntityType, entityId: string) {
  return (
    (await workflowRpc<PrivateDocument[]>("list_private_documents", {
      _entity_type: entityType,
      _entity_id: entityId,
    })) ?? []
  );
}

export async function createPrivateDocumentUrl(documentId: string, expiresIn = 300) {
  const access = await workflowRpc<Access>("get_private_document_access", {
    _document_id: documentId,
  });
  if (!access) throw new Error("Documento indisponível");
  const { data, error } = await supabase.storage
    .from(access.bucket)
    .createSignedUrl(access.path, expiresIn, {
      download: access.name,
    });
  if (error || !data?.signedUrl)
    throw error ?? new Error("Não foi possível gerar o acesso temporário");
  return data.signedUrl;
}

export async function openPrivateDocument(documentId: string) {
  const url = await createPrivateDocumentUrl(documentId);
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openWorkflowDocument(documentId: string) {
  const access = await workflowRpc<Access>("get_workflow_document_access", {
    _document_id: documentId,
  });
  if (!access) throw new Error("Documento indisponível");
  const { data, error } = await supabase.storage
    .from(access.bucket)
    .createSignedUrl(access.path, 300, { download: access.name });
  if (error || !data?.signedUrl) throw error ?? new Error("Documento indisponível");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function logicalDeletePrivateDocument(documentId: string, reason: string) {
  return workflowRpc("logical_delete_private_document", {
    _document_id: documentId,
    _reason: reason,
  });
}
