import { PDFDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import { SUBFILTER_ETSI_CADES_DETACHED } from "@signpdf/utils";

/**
 * Firma digitalmente un PDF (PAdES básico) usando un certificado .p12/.pfx
 * que el propio usuario aporta en el momento de firmar. Todo ocurre en el
 * navegador: el certificado y la contraseña no se envían ni se guardan en
 * ningún sitio, solo se usan en memoria para esta operación.
 */
export async function signPdfWithCertificate(
  pdfBytes: Uint8Array,
  p12Bytes: ArrayBuffer,
  password: string
): Promise<Uint8Array> {
  // pdf-lib necesita reservar espacio (placeholder) para la firma antes de
  // que signpdf calcule el hash y lo sustituya por la firma real.
  const doc = await PDFDocument.load(pdfBytes);
  pdflibAddPlaceholder({
    pdfDoc: doc as any,
    reason: "Firma de factura Facturtaxi",
    contactInfo: "",
    name: "Facturtaxi",
    location: "",
    // PAdES-B (ETSI EN 319 142-1) en vez del filtro heredado "adbe.pkcs7.detached":
    // es el que usan las herramientas españolas oficiales (AutoFirma, etc.) y el
    // que esperan los validadores modernos más estrictos.
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
  });

  const pdfWithPlaceholder = await doc.save({ useObjectStreams: false });

  const signer = new P12Signer(Buffer.from(p12Bytes), { passphrase: password });
  const signpdf = new SignPdf();
  const signed = await signpdf.sign(Buffer.from(pdfWithPlaceholder), signer);

  return new Uint8Array(signed);
}
