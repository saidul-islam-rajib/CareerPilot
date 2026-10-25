const PDF_MEDIA_TYPE = 'application/pdf';
const OFFSET_WIDTH = 10;

function escapePdfText(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
}

export function samplePdf(title: string): string {
  const stream = `BT /F1 20 Tf 72 720 Td (${escapePdfText(title)}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((content, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(OFFSET_WIDTH, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return body;
}

export function samplePdfDataUri(title: string): string {
  return `data:${PDF_MEDIA_TYPE};base64,${btoa(samplePdf(title))}`;
}
