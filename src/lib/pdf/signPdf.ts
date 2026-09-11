import { PDFDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";

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
  });

  const pdfWithPlaceholder = await doc.save({ useObjectStreams: false });

  const signer = new P12Signer(Buffer.from(p12Bytes), { passphrase: password });
  const signpdf = new SignPdf();
  const signed = await signpdf.sign(Buffer.from(pdfWithPlaceholder), signer);

  return new Uint8Array(signed);
}
