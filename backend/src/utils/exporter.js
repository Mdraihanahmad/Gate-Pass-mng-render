import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, TextRun } from 'docx';

export const buildPdfStream = (title, headers = [], rows = []) => {
  const doc = new PDFDocument({ margin: 40 });
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10);

  // headers
  doc.text(headers.join(' | '));
  doc.moveDown(0.5);
  rows.forEach((r) => doc.text(r.map((c) => `${c ?? ''}`).join(' | ')));
  doc.end();
  return doc; // PDFKit readable stream
};

export const buildDocxBuffer = async (title, headers = [], rows = []) => {
  const tableRows = [
    new TableRow({
      children: headers.map((h) => new TableCell({ children: [new Paragraph({ text: String(h), heading: HeadingLevel.HEADING_3 })] })),
    }),
    ...rows.map(
      (r) =>
        new TableRow({
          children: r.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun(String(c ?? ''))] })] })),
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }), new Table({ rows: tableRows })],
      },
    ],
  });
  return await Packer.toBuffer(doc);
};
