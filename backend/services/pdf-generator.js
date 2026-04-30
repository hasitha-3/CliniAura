const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { AuditLedger } = require('./audit-logger');

const generateCompliancePDF = async (wardId) => {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  // Draw Header
  page.drawText('Cliniaura Healthcare Platform', { x: 50, y: height - 50, size: 20, font: timesRomanBold, color: rgb(0, 0.53, 0.71) });
  page.drawText('Medicolegal Compliance & Audit Report', { x: 50, y: height - 80, size: 14, font: timesRomanFont });
  page.drawText(`Generated on: ${new Date().toISOString()}`, { x: 50, y: height - 100, size: 10, font: timesRomanFont });
  page.drawText(`Ward: ${wardId || 'All Wards'}`, { x: 50, y: height - 115, size: 10, font: timesRomanFont });

  // Draw Line
  page.drawLine({
    start: { x: 50, y: height - 130 },
    end: { x: width - 50, y: height - 130 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Fetch recent ledger entries
  const filter = wardId ? { wardId } : {};
  const records = await AuditLedger.find(filter).sort({ timestamp: -1 }).limit(20);

  let yPosition = height - 160;
  
  page.drawText('Recent Immutable Audit Ledger Events:', { x: 50, y: yPosition, size: 12, font: timesRomanBold });
  yPosition -= 20;

  for (const record of records) {
    if (yPosition < 50) {
      // Create new page if out of space (simplified)
      break;
    }
    
    const timeStr = new Date(record.timestamp).toLocaleString();
    const txt = `[${timeStr}] ${record.eventType} - Patient: ${record.patientId || 'N/A'} - User: ${record.userId}`;
    page.drawText(txt, { x: 50, y: yPosition, size: 10, font: timesRomanFont });
    yPosition -= 15;
    
    const hashTxt = `Hash: ${record.currentHash.substring(0, 32)}...`;
    page.drawText(hashTxt, { x: 70, y: yPosition, size: 8, font: timesRomanFont, color: rgb(0.4, 0.4, 0.4) });
    yPosition -= 20;
  }

  // Draw Footer
  page.drawText('This document is a certified extract from the Cliniaura tamper-evident ledger.', {
    x: 50, y: 30, size: 8, font: timesRomanFont, color: rgb(0.2, 0.2, 0.2)
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};

module.exports = { generateCompliancePDF };
