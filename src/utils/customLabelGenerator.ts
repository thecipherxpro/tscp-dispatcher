import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { CustomOrder } from '@/hooks/useCustomOrders';

export interface LabelOptions {
  type: 'standard' | 'shipped' | 'completed';
  shippedAt?: string;
  deliveredAt?: string;
}

const formatDate = (date: string | null | undefined): string => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (date: string | null | undefined): string => {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const loadImageAsBytes = async (imageSrc: string): Promise<Uint8Array> => {
  const response = await fetch(imageSrc);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
};

async function generateSingleLabel(
  pdfDoc: PDFDocument,
  order: CustomOrder,
  options: LabelOptions,
  helveticaBold: any,
  helvetica: any,
  appLogoBytes: Uint8Array | null,
  fragileBytes: Uint8Array | null
): Promise<void> {
  const page = pdfDoc.addPage([288, 432]);
  const { width, height } = page.getSize();
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const blue = rgb(0.2, 0.4, 0.8);
  
  const marginLeft = 16;
  const marginRight = 16;
  
  // ============================================
  // HEADER
  // ============================================
  const headerHeight = 32;
  const headerY = height - headerHeight;
  
  page.drawRectangle({
    x: 0,
    y: headerY,
    width: width,
    height: headerHeight,
    color: rgb(0.9, 0.9, 0.9),
  });
  
  page.drawText("endoverdose.ca", {
    x: marginLeft,
    y: headerY + (headerHeight / 2) - 4,
    size: 8,
    font: helvetica,
    color: black,
  });
  
  const logoSize = 18;
  const logoX = (width - logoSize) / 2;
  const logoY = headerY + (headerHeight - logoSize) / 2;
  
  if (appLogoBytes) {
    try {
      const logoImg = await pdfDoc.embedPng(appLogoBytes);
      page.drawImage(logoImg, {
        x: logoX,
        y: logoY,
        width: logoSize,
        height: logoSize,
      });
    } catch (e) {
      console.error("Failed to embed logo:", e);
    }
  }
  
  const email = "Info@endoverdose.ca";
  const emailWidth = helvetica.widthOfTextAtSize(email, 8);
  page.drawText(email, {
    x: width - marginRight - emailWidth,
    y: headerY + (headerHeight / 2) - 4,
    size: 8,
    font: helvetica,
    color: black,
  });
  
  // Divider
  const divider1Y = height - 56;
  page.drawLine({
    start: { x: marginLeft, y: divider1Y },
    end: { x: width - marginRight, y: divider1Y },
    thickness: 1,
    color: lightGray,
  });
  
  // ============================================
  // FROM SECTION
  // ============================================
  const fromStartY = height - 72;
  
  page.drawText("FROM:", {
    x: marginLeft,
    y: fromStartY,
    size: 7,
    font: helveticaBold,
    color: gray,
  });
  
  page.drawText("CanadaHarmControl", {
    x: marginLeft,
    y: fromStartY - 12,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  
  page.drawText("Healthcare Delivery Service", {
    x: marginLeft,
    y: fromStartY - 23,
    size: 7,
    font: helvetica,
    color: gray,
  });
  
  page.drawText("3265 Wharton Way #23", {
    x: marginLeft,
    y: fromStartY - 35,
    size: 8,
    font: helvetica,
    color: black,
  });
  
  page.drawText("Mississauga, ON L4X 2X9", {
    x: marginLeft,
    y: fromStartY - 46,
    size: 8,
    font: helvetica,
    color: black,
  });
  
  page.drawText("(647) 494-4538", {
    x: marginLeft,
    y: fromStartY - 57,
    size: 8,
    font: helvetica,
    color: black,
  });
  
  // ============================================
  // RIGHT COLUMN
  // ============================================
  const rightColX = 158;
  const labelValueGap = 10;
  
  page.drawText("ORDER DATE:", {
    x: rightColX,
    y: fromStartY,
    size: 7,
    font: helveticaBold,
    color: gray,
  });
  page.drawText(formatDate(order.order_date), {
    x: rightColX,
    y: fromStartY - labelValueGap,
    size: 9,
    font: helvetica,
    color: black,
  });
  
  // Shipped - use custom or default
  page.drawText("SHIPPED:", {
    x: rightColX,
    y: fromStartY - 28,
    size: 7,
    font: helveticaBold,
    color: gray,
  });
  
  const shippedDateStr = options.type !== 'standard' && options.shippedAt
    ? `${formatDate(options.shippedAt)} ${formatTime(options.shippedAt)}`.trim()
    : formatDate(order.shipping_date);
  
  page.drawText(shippedDateStr, {
    x: rightColX,
    y: fromStartY - 28 - labelValueGap,
    size: 9,
    font: helvetica,
    color: black,
  });
  
  page.drawText("SHIPMENT ID:", {
    x: rightColX,
    y: fromStartY - 56,
    size: 7,
    font: helveticaBold,
    color: gray,
  });
  page.drawText(order.shipment_id || "N/A", {
    x: rightColX,
    y: fromStartY - 56 - labelValueGap,
    size: 9,
    font: helveticaBold,
    color: black,
  });
  
  // Divider
  const divider2Y = height - 145;
  page.drawLine({
    start: { x: marginLeft, y: divider2Y },
    end: { x: width - marginRight, y: divider2Y },
    thickness: 1,
    color: lightGray,
  });
  
  // ============================================
  // SHIP TO SECTION
  // ============================================
  const shipToStartY = height - 160;
  
  page.drawText("SHIP TO:", {
    x: marginLeft,
    y: shipToStartY,
    size: 7,
    font: helveticaBold,
    color: gray,
  });
  
  page.drawText(order.client_name || "Customer", {
    x: marginLeft,
    y: shipToStartY - 14,
    size: 12,
    font: helveticaBold,
    color: black,
  });
  
  let addressY = shipToStartY - 28;
  if (order.address_line_1) {
    page.drawText(order.address_line_1, {
      x: marginLeft,
      y: addressY,
      size: 9,
      font: helvetica,
      color: black,
    });
    addressY -= 12;
  }
  
  if (order.address_line_2) {
    page.drawText(order.address_line_2, {
      x: marginLeft,
      y: addressY,
      size: 9,
      font: helvetica,
      color: black,
    });
    addressY -= 12;
  }
  
  page.drawText(order.country || "Canada", {
    x: marginLeft,
    y: addressY,
    size: 9,
    font: helvetica,
    color: black,
  });
  
  // Divider
  const divider3Y = height - 230;
  page.drawLine({
    start: { x: marginLeft, y: divider3Y },
    end: { x: width - marginRight, y: divider3Y },
    thickness: 1,
    color: lightGray,
  });
  
  // ============================================
  // QR CODE PLACEHOLDER
  // ============================================
  const qrSize = 100;
  const qrY = height - 340;
  
  page.drawRectangle({
    x: marginLeft,
    y: qrY,
    width: qrSize,
    height: qrSize,
    borderColor: lightGray,
    borderWidth: 1,
  });
  page.drawText("QR CODE", {
    x: marginLeft + 25,
    y: qrY + 45,
    size: 10,
    font: helvetica,
    color: gray,
  });
  
  // ============================================
  // TRACKING INFO
  // ============================================
  const trackingX = marginLeft + qrSize + 16;
  const trackingY = qrY + qrSize - 10;
  
  page.drawText("TRACKING NUMBER:", {
    x: trackingX,
    y: trackingY,
    size: 7,
    font: helveticaBold,
    color: gray,
  });
  
  page.drawText(order.tracking_id || "N/A", {
    x: trackingX,
    y: trackingY - 16,
    size: 11,
    font: helveticaBold,
    color: black,
  });
  
  page.drawText("Scan QR code to", {
    x: trackingX,
    y: trackingY - 40,
    size: 8,
    font: helvetica,
    color: gray,
  });
  page.drawText("track your delivery", {
    x: trackingX,
    y: trackingY - 52,
    size: 8,
    font: helvetica,
    color: gray,
  });
  
  // ============================================
  // DELIVERED ON (for completed type)
  // ============================================
  if (options.type === 'completed' && options.deliveredAt) {
    page.drawText("DELIVERED ON:", {
      x: trackingX,
      y: trackingY - 70,
      size: 7,
      font: helveticaBold,
      color: gray,
    });
    page.drawText(`${formatDate(options.deliveredAt)} ${formatTime(options.deliveredAt)}`.trim(), {
      x: trackingX,
      y: trackingY - 82,
      size: 9,
      font: helveticaBold,
      color: rgb(0.1, 0.5, 0.1),
    });
  }
  
  // ============================================
  // FRAGILE BADGE
  // ============================================
  if (fragileBytes) {
    try {
      const fragileImg = await pdfDoc.embedPng(fragileBytes);
      const badgeAspectRatio = 656 / 147;
      const badgeHeight = 30;
      const badgeWidth = badgeHeight * badgeAspectRatio;
      
      page.drawImage(fragileImg, {
        x: trackingX,
        y: options.type === 'completed' ? trackingY - 120 : trackingY - 95,
        width: badgeWidth,
        height: badgeHeight,
      });
    } catch (e) {
      console.error("Failed to embed fragile badge:", e);
    }
  }
  
  // ============================================
  // COMPLETED STAMP (for completed type)
  // ============================================
  if (options.type === 'completed') {
    const stampWidth = 80;
    const stampHeight = 30;
    const stampX = width - marginRight - stampWidth - 10;
    const stampY = 50;
    
    // Draw rotated stamp background
    page.drawRectangle({
      x: stampX,
      y: stampY,
      width: stampWidth,
      height: stampHeight,
      color: blue,
      borderColor: rgb(0.1, 0.3, 0.7),
      borderWidth: 2,
      rotate: degrees(-12),
    });
    
    // Draw stamp text
    const stampText = "COMPLETED";
    const stampTextWidth = helveticaBold.widthOfTextAtSize(stampText, 10);
    page.drawText(stampText, {
      x: stampX + (stampWidth - stampTextWidth) / 2 + 5,
      y: stampY + 10,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
      rotate: degrees(-12),
    });
  }
  
  // ============================================
  // FOOTER
  // ============================================
  const footerHeight = 32;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: footerHeight,
    color: rgb(0.1, 0.1, 0.1),
  });
  
  const footerText = "HEALTHCARE DELIVERY • HANDLE WITH CARE";
  const footerTextWidth = helveticaBold.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, {
    x: (width - footerTextWidth) / 2,
    y: 12,
    size: 8,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
}

export async function generateCustomLabels(
  orders: CustomOrder[],
  options: LabelOptions,
  onProgress?: (progress: number) => void
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Load images once
  let appLogoBytes: Uint8Array | null = null;
  let fragileBytes: Uint8Array | null = null;
  
  try {
    const logoModule = await import('@/assets/app-icon.png');
    appLogoBytes = await loadImageAsBytes(logoModule.default);
  } catch (e) {
    console.error("Failed to load app logo:", e);
  }
  
  try {
    const fragileModule = await import('@/assets/label-fragile.png');
    fragileBytes = await loadImageAsBytes(fragileModule.default);
  } catch (e) {
    console.error("Failed to load fragile image:", e);
  }
  
  for (let i = 0; i < orders.length; i++) {
    await generateSingleLabel(
      pdfDoc,
      orders[i],
      options,
      helveticaBold,
      helvetica,
      appLogoBytes,
      fragileBytes
    );
    
    if (onProgress) {
      onProgress(Math.round(((i + 1) / orders.length) * 100));
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  
  // Download
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `custom-labels-${options.type}-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
