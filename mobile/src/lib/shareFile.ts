import RNFS from "react-native-fs";
import Share from "react-native-share";

/**
 * Comparte un PDF como archivo real usando el panel nativo de Android/iOS.
 * react-native-share en Android NO admite pasarle directamente una URI
 * "data:" con el PDF en base64 (falla con "Uri.getScheme() on a null object
 * reference") — hay que escribir el archivo a disco primero y compartir esa
 * ruta "file://". Comprobado con un fallo real en el emulador.
 */
export async function sharePdfBase64(base64: string, filenameNoExt: string): Promise<void> {
  const path = `${RNFS.CachesDirectoryPath}/${filenameNoExt}.pdf`;
  await RNFS.writeFile(path, base64, "base64");
  await Share.open({
    url: `file://${path}`,
    type: "application/pdf",
    filename: filenameNoExt,
    failOnCancel: false,
  });
}
