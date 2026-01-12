import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { CustomOrder } from '@/hooks/useCustomOrders';
import QRCode from 'qrcode';

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

const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return "N/A";
  return `${formatDate(date)} ${formatTime(date)}`.trim();
};

const loadImageAsBytes = async (imageSrc: string): Promise<Uint8Array> => {
  const response = await fetch(imageSrc);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
};

const generateQRCodeDataUrl = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    return '';
  }
};

const dataUrlToBytes = async (dataUrl: string): Promise<Uint8Array> => {
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

async function generateSingleLabel(
  pdfDoc: PDFDocument,
  order: CustomOrder,
  options: LabelOptions,
  helveticaBold: any,
  helvetica: any,
  appLogoBytes: Uint8Array | null,
  fragileBytes: Uint8Array | null,
  deliveredStampBytes: Uint8Array | null
): Promise<void> {
  const page = pdfDoc.addPage([288, 432]);
  const { width, height } = page.getSize();
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);
  
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
  // QR CODE - Generate actual QR code
  // ============================================
  const qrSize = 100;
  const qrY = height - 340;
  
  // Generate tracking URL for QR code
  const trackingUrl = order.tracking_url || `https://endoverdose.ca/track/${order.tracking_id || 'N/A'}`;
  const qrDataUrl = await generateQRCodeDataUrl(trackingUrl);
  
  if (qrDataUrl) {
    try {
      const qrBytes = await dataUrlToBytes(qrDataUrl);
      const qrImage = await pdfDoc.embedPng(qrBytes);
      page.drawImage(qrImage, {
        x: marginLeft,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });
    } catch (e) {
      console.error("Failed to embed QR code:", e);
      // Fallback: draw placeholder
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
    }
  }
  
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
  
  // ============================================
  // DELIVERED STAMP IMAGE (for completed type)
  // ============================================
  if (options.type === 'completed' && deliveredStampBytes) {
    try {
      const stampImg = await pdfDoc.embedPng(deliveredStampBytes);
      const stampWidth = 80;
      const stampHeight = 80;
      
      page.drawImage(stampImg, {
        x: trackingX,
        y: trackingY - 95,
        width: stampWidth,
        height: stampHeight,
      });
    } catch (e) {
      console.error("Failed to embed delivered stamp:", e);
    }
  } else {
    // Show scan text for non-completed labels
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
  }
  
  // ============================================
  // FRAGILE BADGE
  // ============================================
  if (fragileBytes && options.type !== 'completed') {
    try {
      const fragileImg = await pdfDoc.embedPng(fragileBytes);
      const badgeAspectRatio = 656 / 147;
      const badgeHeight = 30;
      const badgeWidth = badgeHeight * badgeAspectRatio;
      
      page.drawImage(fragileImg, {
        x: trackingX,
        y: trackingY - 95,
        width: badgeWidth,
        height: badgeHeight,
      });
    } catch (e) {
      console.error("Failed to embed fragile badge:", e);
    }
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

// ============================================
// DELIVERY RECEIPT GENERATOR (5x7 inch)
// ============================================
async function generateSingleReceipt(
  pdfDoc: PDFDocument,
  order: CustomOrder,
  options: LabelOptions,
  helveticaBold: any,
  helvetica: any,
  appLogoBytes: Uint8Array | null
): Promise<void> {
  // 5x7 inches = 360x504 points (72 points per inch)
  const page = pdfDoc.addPage([360, 504]);
  const { width, height } = page.getSize();
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const darkGray = rgb(0.2, 0.2, 0.2);
  
  const marginLeft = 24;
  const marginRight = 24;
  const contentWidth = width - marginLeft - marginRight;
  
  // ============================================
  // HEADER - Dark Background
  // ============================================
  const headerHeight = 60;
  const headerY = height - headerHeight;
  
  page.drawRectangle({
    x: 0,
    y: headerY,
    width: width,
    height: headerHeight,
    color: darkGray,
  });
  
  // Logo
  const logoSize = 40;
  if (appLogoBytes) {
    try {
      const logoImg = await pdfDoc.embedPng(appLogoBytes);
      page.drawImage(logoImg, {
        x: marginLeft,
        y: headerY + (headerHeight - logoSize) / 2,
        width: logoSize,
        height: logoSize,
      });
    } catch (e) {
      console.error("Failed to embed logo in receipt:", e);
    }
  }
  
  // Title
  const titleText = "DELIVERY RECEIPT";
  page.drawText(titleText, {
    x: marginLeft + logoSize + 16,
    y: headerY + headerHeight / 2 + 6,
    size: 16,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  
  // Shipment ID in header
  const shipmentIdText = `SHIPMENT ID: ${order.shipment_id || 'N/A'}`;
  page.drawText(shipmentIdText, {
    x: marginLeft + logoSize + 16,
    y: headerY + headerHeight / 2 - 12,
    size: 9,
    font: helvetica,
    color: rgb(0.7, 0.7, 0.7),
  });
  
  // ============================================
  // COMPANY INFO SECTION
  // ============================================
  let currentY = height - headerHeight - 30;
  
  page.drawText("EndOverdose", {
    x: marginLeft,
    y: currentY,
    size: 14,
    font: helveticaBold,
    color: black,
  });
  
  currentY -= 16;
  page.drawText("3265 Wharton Way #23, Mississauga, ON L4X 2X9", {
    x: marginLeft,
    y: currentY,
    size: 9,
    font: helvetica,
    color: gray,
  });
  
  currentY -= 12;
  page.drawText("Phone: (647) 494-4538 • Email: Info@endoverdose.ca", {
    x: marginLeft,
    y: currentY,
    size: 9,
    font: helvetica,
    color: gray,
  });
  
  // Divider
  currentY -= 20;
  page.drawLine({
    start: { x: marginLeft, y: currentY },
    end: { x: width - marginRight, y: currentY },
    thickness: 1,
    color: lightGray,
  });
  
  // ============================================
  // ORDER DETAILS SECTION
  // ============================================
  currentY -= 25;
  page.drawText("Order Details:", {
    x: marginLeft,
    y: currentY,
    size: 12,
    font: helveticaBold,
    color: black,
  });
  
  // Client Name
  currentY -= 22;
  page.drawText("CLIENT:", {
    x: marginLeft,
    y: currentY,
    size: 8,
    font: helveticaBold,
    color: gray,
  });
  page.drawText(order.client_name || "N/A", {
    x: marginLeft + 60,
    y: currentY,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  
  // Address
  currentY -= 16;
  page.drawText("ADDRESS:", {
    x: marginLeft,
    y: currentY,
    size: 8,
    font: helveticaBold,
    color: gray,
  });
  
  const fullAddress = [order.address_line_1, order.address_line_2, order.country || 'Canada']
    .filter(Boolean)
    .join(', ');
  
  page.drawText(fullAddress || "N/A", {
    x: marginLeft + 60,
    y: currentY,
    size: 9,
    font: helvetica,
    color: black,
  });
  
  // Authorizing Doctor
  currentY -= 16;
  page.drawText("DOCTOR:", {
    x: marginLeft,
    y: currentY,
    size: 8,
    font: helveticaBold,
    color: gray,
  });
  page.drawText(order.authorizing_doctor_name || "N/A", {
    x: marginLeft + 60,
    y: currentY,
    size: 9,
    font: helvetica,
    color: black,
  });
  
  // Divider
  currentY -= 20;
  page.drawLine({
    start: { x: marginLeft, y: currentY },
    end: { x: width - marginRight, y: currentY },
    thickness: 1,
    color: lightGray,
  });
  
  // ============================================
  // MEDICATION SECTION
  // ============================================
  currentY -= 25;
  page.drawText("Medication:", {
    x: marginLeft,
    y: currentY,
    size: 12,
    font: helveticaBold,
    color: black,
  });
  
  // Injection details (if any)
  if (order.injection_drug_name || order.injection_qty) {
    currentY -= 20;
    page.drawText("INJECTION:", {
      x: marginLeft,
      y: currentY,
      size: 8,
      font: helveticaBold,
      color: gray,
    });
    
    const injectionInfo = [
      order.injection_drug_name,
      order.injection_strength,
      order.injection_qty ? `Qty: ${order.injection_qty}` : null,
    ].filter(Boolean).join(' • ');
    
    page.drawText(injectionInfo || "N/A", {
      x: marginLeft + 70,
      y: currentY,
      size: 9,
      font: helvetica,
      color: black,
    });
    
    if (order.injection_rx_number) {
      currentY -= 14;
      page.drawText(`RX#: ${order.injection_rx_number}`, {
        x: marginLeft + 70,
        y: currentY,
        size: 8,
        font: helvetica,
        color: gray,
      });
    }
  }
  
  // Nasal details (if any)
  if (order.nasal_drug_name || order.nasal_qty) {
    currentY -= 20;
    page.drawText("NASAL:", {
      x: marginLeft,
      y: currentY,
      size: 8,
      font: helveticaBold,
      color: gray,
    });
    
    const nasalInfo = [
      order.nasal_drug_name,
      order.nasal_qty ? `Qty: ${order.nasal_qty}` : null,
    ].filter(Boolean).join(' • ');
    
    page.drawText(nasalInfo || "N/A", {
      x: marginLeft + 70,
      y: currentY,
      size: 9,
      font: helvetica,
      color: black,
    });
    
    if (order.nasal_rx_number) {
      currentY -= 14;
      page.drawText(`RX#: ${order.nasal_rx_number}`, {
        x: marginLeft + 70,
        y: currentY,
        size: 8,
        font: helvetica,
        color: gray,
      });
    }
  }
  
  // Divider
  currentY -= 25;
  page.drawLine({
    start: { x: marginLeft, y: currentY },
    end: { x: width - marginRight, y: currentY },
    thickness: 1,
    color: lightGray,
  });
  
  // ============================================
  // DATES SECTION - SHIPPED & DELIVERED
  // ============================================
  currentY -= 30;
  
  // Two-column layout for dates
  const colWidth = contentWidth / 2;
  
  // SHIPPED DATE box
  page.drawRectangle({
    x: marginLeft,
    y: currentY - 45,
    width: colWidth - 10,
    height: 55,
    borderColor: lightGray,
    borderWidth: 1,
  });
  
  page.drawText("SHIPPED DATE:", {
    x: marginLeft + 10,
    y: currentY - 5,
    size: 8,
    font: helveticaBold,
    color: gray,
  });
  
  const shippedDateStr = options.shippedAt ? formatDateTime(options.shippedAt) : formatDate(order.shipping_date);
  page.drawText(shippedDateStr, {
    x: marginLeft + 10,
    y: currentY - 25,
    size: 11,
    font: helveticaBold,
    color: black,
  });
  
  // DELIVERED DATE box
  page.drawRectangle({
    x: marginLeft + colWidth,
    y: currentY - 45,
    width: colWidth - 10,
    height: 55,
    borderColor: lightGray,
    borderWidth: 1,
  });
  
  page.drawText("DELIVERED DATE:", {
    x: marginLeft + colWidth + 10,
    y: currentY - 5,
    size: 8,
    font: helveticaBold,
    color: gray,
  });
  
  const deliveredDateStr = options.deliveredAt ? formatDateTime(options.deliveredAt) : "N/A";
  page.drawText(deliveredDateStr, {
    x: marginLeft + colWidth + 10,
    y: currentY - 25,
    size: 11,
    font: helveticaBold,
    color: rgb(0.1, 0.5, 0.1),
  });
  
  // ============================================
  // SIGNATURE SECTION
  // ============================================
  currentY -= 90;
  
  page.drawText("Recipient Signature:", {
    x: marginLeft,
    y: currentY,
    size: 9,
    font: helvetica,
    color: gray,
  });
  
  currentY -= 30;
  page.drawLine({
    start: { x: marginLeft, y: currentY },
    end: { x: width - marginRight - 100, y: currentY },
    thickness: 1,
    color: black,
  });
  
  page.drawText("Date:", {
    x: width - marginRight - 90,
    y: currentY + 16,
    size: 9,
    font: helvetica,
    color: gray,
  });
  
  page.drawLine({
    start: { x: width - marginRight - 90, y: currentY },
    end: { x: width - marginRight, y: currentY },
    thickness: 1,
    color: black,
  });
  
  // ============================================
  // FOOTER
  // ============================================
  const footerHeight = 30;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: footerHeight,
    color: darkGray,
  });
  
  const footerText = "Thank you for choosing EndOverdose Healthcare Delivery";
  const footerTextWidth = helvetica.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, {
    x: (width - footerTextWidth) / 2,
    y: 11,
    size: 8,
    font: helvetica,
    color: rgb(0.7, 0.7, 0.7),
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
  let deliveredStampBytes: Uint8Array | null = null;
  
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
  
  try {
    const stampModule = await import('@/assets/delivered-stamp.png');
    deliveredStampBytes = await loadImageAsBytes(stampModule.default);
  } catch (e) {
    console.error("Failed to load delivered stamp:", e);
  }
  
  for (let i = 0; i < orders.length; i++) {
    await generateSingleLabel(
      pdfDoc,
      orders[i],
      options,
      helveticaBold,
      helvetica,
      appLogoBytes,
      fragileBytes,
      deliveredStampBytes
    );
    
    if (onProgress) {
      onProgress(Math.round(((i + 1) / orders.length) * 50)); // 0-50% for labels
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  
  // Download labels
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `custom-labels-${options.type}-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  // Generate receipts for shipped and completed types
  if (options.type === 'shipped' || options.type === 'completed') {
    const receiptPdfDoc = await PDFDocument.create();
    const receiptBold = await receiptPdfDoc.embedFont(StandardFonts.HelveticaBold);
    const receiptRegular = await receiptPdfDoc.embedFont(StandardFonts.Helvetica);
    
    for (let i = 0; i < orders.length; i++) {
      await generateSingleReceipt(
        receiptPdfDoc,
        orders[i],
        options,
        receiptBold,
        receiptRegular,
        appLogoBytes
      );
      
      if (onProgress) {
        onProgress(50 + Math.round(((i + 1) / orders.length) * 50)); // 50-100% for receipts
      }
    }
    
    const receiptBytes = await receiptPdfDoc.save();
    
    // Download receipts
    const receiptBlob = new Blob([new Uint8Array(receiptBytes)], { type: 'application/pdf' });
    const receiptUrl = URL.createObjectURL(receiptBlob);
    const receiptLink = document.createElement('a');
    receiptLink.href = receiptUrl;
    receiptLink.download = `delivery-receipts-${options.type}-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(receiptLink);
    
    // Small delay to ensure first download starts
    setTimeout(() => {
      receiptLink.click();
      document.body.removeChild(receiptLink);
      URL.revokeObjectURL(receiptUrl);
    }, 500);
  }
  
  if (onProgress) {
    onProgress(100);
  }
}
