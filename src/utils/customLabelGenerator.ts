import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CustomOrder } from '@/hooks/useCustomOrders';
import QRCode from 'qrcode';
import JSZip from 'jszip';

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

// ============================================
// LABEL GENERATOR (4x6 inch) - No stamp, same as normal orders
// ============================================
async function generateSingleLabel(
  pdfDoc: PDFDocument,
  order: CustomOrder,
  options: LabelOptions,
  helveticaBold: any,
  helvetica: any,
  appLogoBytes: Uint8Array | null,
  fragileBytes: Uint8Array | null
): Promise<void> {
  // 4x6 inches = 288x432 points
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
  
  const shippedDateStr = (options.type === 'shipped' || options.type === 'completed') && options.shippedAt
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
  
  // Scan text
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
// RECEIPT GENERATOR (4x6 inch) - Store receipt style
// ============================================
async function generateSingleReceipt(
  pdfDoc: PDFDocument,
  order: CustomOrder,
  options: LabelOptions,
  helveticaBold: any,
  helvetica: any,
  appLogoBytes: Uint8Array | null,
  deliveredStampBytes: Uint8Array | null
): Promise<void> {
  // 4x6 inches = 288x432 points
  const page = pdfDoc.addPage([288, 432]);
  const { width, height } = page.getSize();
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.5, 0.5, 0.5);
  const lightGray = rgb(0.8, 0.8, 0.8);
  
  const marginLeft = 16;
  const marginRight = 16;
  const contentWidth = width - marginLeft - marginRight;
  const centerX = width / 2;
  
  let currentY = height - 16;
  
  // ============================================
  // HEADER - Company Logo & Name (centered)
  // ============================================
  const logoSize = 32;
  if (appLogoBytes) {
    try {
      const logoImg = await pdfDoc.embedPng(appLogoBytes);
      page.drawImage(logoImg, {
        x: centerX - logoSize / 2,
        y: currentY - logoSize,
        width: logoSize,
        height: logoSize,
      });
    } catch (e) {
      console.error("Failed to embed logo in receipt:", e);
    }
  }
  
  currentY -= logoSize + 12; // Added more gap after logo
  
  const companyName = "EndOverdose";
  const companyNameWidth = helveticaBold.widthOfTextAtSize(companyName, 12);
  page.drawText(companyName, {
    x: centerX - companyNameWidth / 2,
    y: currentY,
    size: 12,
    font: helveticaBold,
    color: black,
  });
  
  currentY -= 11;
  const tagline = "Healthcare Delivery Service";
  const taglineWidth = helvetica.widthOfTextAtSize(tagline, 7);
  page.drawText(tagline, {
    x: centerX - taglineWidth / 2,
    y: currentY,
    size: 7,
    font: helvetica,
    color: gray,
  });
  
  currentY -= 9;
  const address1 = "3265 Wharton Way #23, Mississauga, ON";
  const address1Width = helvetica.widthOfTextAtSize(address1, 6);
  page.drawText(address1, {
    x: centerX - address1Width / 2,
    y: currentY,
    size: 6,
    font: helvetica,
    color: gray,
  });
  
  currentY -= 8;
  const contact = "(647) 494-4538 • Info@endoverdose.ca";
  const contactWidth = helvetica.widthOfTextAtSize(contact, 6);
  page.drawText(contact, {
    x: centerX - contactWidth / 2,
    y: currentY,
    size: 6,
    font: helvetica,
    color: gray,
  });
  
  // Dashed divider
  currentY -= 12;
  for (let x = marginLeft; x < width - marginRight; x += 6) {
    page.drawLine({
      start: { x, y: currentY },
      end: { x: x + 3, y: currentY },
      thickness: 1,
      color: lightGray,
    });
  }
  
  // ============================================
  // RECEIPT TITLE
  // ============================================
  currentY -= 16;
  const receiptTitle = "DELIVERY RECEIPT";
  const receiptTitleWidth = helveticaBold.widthOfTextAtSize(receiptTitle, 12);
  page.drawText(receiptTitle, {
    x: centerX - receiptTitleWidth / 2,
    y: currentY,
    size: 12,
    font: helveticaBold,
    color: black,
  });
  
  currentY -= 12;
  const shipmentIdText = `#${order.shipment_id || 'N/A'}`;
  const shipmentIdWidth = helvetica.widthOfTextAtSize(shipmentIdText, 9);
  page.drawText(shipmentIdText, {
    x: centerX - shipmentIdWidth / 2,
    y: currentY,
    size: 9,
    font: helvetica,
    color: gray,
  });
  
  // Dashed divider
  currentY -= 12;
  for (let x = marginLeft; x < width - marginRight; x += 6) {
    page.drawLine({
      start: { x, y: currentY },
      end: { x: x + 3, y: currentY },
      thickness: 1,
      color: lightGray,
    });
  }
  
  // ============================================
  // CLIENT INFO SECTION
  // ============================================
  currentY -= 16;
  page.drawText("CLIENT", {
    x: marginLeft,
    y: currentY,
    size: 7,
    font: helveticaBold,
    color: gray,
  });
  
  currentY -= 12;
  page.drawText(order.client_name || "N/A", {
    x: marginLeft,
    y: currentY,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  
  currentY -= 12;
  const fullAddress = [order.address_line_1, order.address_line_2].filter(Boolean).join(', ');
  page.drawText(fullAddress || "N/A", {
    x: marginLeft,
    y: currentY,
    size: 8,
    font: helvetica,
    color: black,
  });
  
  currentY -= 10;
  page.drawText(order.country || "Canada", {
    x: marginLeft,
    y: currentY,
    size: 8,
    font: helvetica,
    color: black,
  });
  
  // ============================================
  // AUTHORIZED DOCTOR
  // ============================================
  currentY -= 16;
  page.drawText("AUTHORIZED BY", {
    x: marginLeft,
    y: currentY,
    size: 7,
    font: helveticaBold,
    color: gray,
  });
  
  currentY -= 12;
  page.drawText(`Dr. ${order.authorizing_doctor_name || 'N/A'}`, {
    x: marginLeft,
    y: currentY,
    size: 9,
    font: helvetica,
    color: black,
  });
  
  // Dashed divider
  currentY -= 12;
  for (let x = marginLeft; x < width - marginRight; x += 6) {
    page.drawLine({
      start: { x, y: currentY },
      end: { x: x + 3, y: currentY },
      thickness: 1,
      color: lightGray,
    });
  }
  
  // ============================================
  // MEDICATION SECTION (2-column layout with DIN)
  // ============================================
  currentY -= 12;
  page.drawText("MEDICATION DETAILS", {
    x: marginLeft,
    y: currentY,
    size: 7,
    font: helveticaBold,
    color: gray,
  });
  
  const col1X = marginLeft;
  const col2X = marginLeft + 125; // Right column for values
  const rowHeight = 9;
  
  // Injection details
  if (order.injection_drug_name || order.injection_qty || order.injection_rx_number) {
    currentY -= 12;
    page.drawText("INJECTION", {
      x: marginLeft,
      y: currentY,
      size: 6,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // Qty on the right
    if (order.injection_qty) {
      const qtyText = `Qty: ${order.injection_qty}`;
      const qtyWidth = helveticaBold.widthOfTextAtSize(qtyText, 7);
      page.drawText(qtyText, {
        x: width - marginRight - qtyWidth,
        y: currentY,
        size: 7,
        font: helveticaBold,
        color: black,
      });
    }
    
    // Drug Name
    currentY -= rowHeight + 2;
    page.drawText("Drug:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
    page.drawText(order.injection_drug_name || 'N/A', { x: col2X, y: currentY, size: 7, font: helveticaBold, color: black });
    
    // DIN
    if (order.injection_din) {
      currentY -= rowHeight;
      page.drawText("DIN:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
      page.drawText(order.injection_din, { x: col2X, y: currentY, size: 7, font: helvetica, color: black });
    }
    
    // RX Number
    if (order.injection_rx_number) {
      currentY -= rowHeight;
      page.drawText("RX#:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
      page.drawText(order.injection_rx_number, { x: col2X, y: currentY, size: 7, font: helvetica, color: black });
    }
    
    // Strength & Form
    if (order.injection_strength || order.injection_form) {
      currentY -= rowHeight;
      page.drawText("Strength/Form:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
      const strengthForm = [order.injection_strength, order.injection_form].filter(Boolean).join(' / ');
      page.drawText(strengthForm, { x: col2X, y: currentY, size: 7, font: helvetica, color: black });
    }
    
    // Package
    if (order.injection_package) {
      currentY -= rowHeight;
      page.drawText("Package:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
      page.drawText(order.injection_package, { x: col2X, y: currentY, size: 7, font: helvetica, color: black });
    }
    
    // Billing Date
    if (order.injection_billing_date) {
      currentY -= rowHeight;
      page.drawText("Billing:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
      page.drawText(formatDate(order.injection_billing_date), { x: col2X, y: currentY, size: 7, font: helvetica, color: black });
    }
  }
  
  // Nasal details
  if (order.nasal_drug_name || order.nasal_qty || order.nasal_rx_number) {
    currentY -= 14;
    page.drawText("NASAL", {
      x: marginLeft,
      y: currentY,
      size: 6,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // Qty on the right
    if (order.nasal_qty) {
      const qtyText = `Qty: ${order.nasal_qty}`;
      const qtyWidth = helveticaBold.widthOfTextAtSize(qtyText, 7);
      page.drawText(qtyText, {
        x: width - marginRight - qtyWidth,
        y: currentY,
        size: 7,
        font: helveticaBold,
        color: black,
      });
    }
    
    // Drug Name
    currentY -= rowHeight + 2;
    page.drawText("Drug:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
    page.drawText(order.nasal_drug_name || 'N/A', { x: col2X, y: currentY, size: 7, font: helveticaBold, color: black });
    
    // DIN
    if (order.nasal_din) {
      currentY -= rowHeight;
      page.drawText("DIN:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
      page.drawText(order.nasal_din, { x: col2X, y: currentY, size: 7, font: helvetica, color: black });
    }
    
    // RX Number
    if (order.nasal_rx_number) {
      currentY -= rowHeight;
      page.drawText("RX#:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
      page.drawText(order.nasal_rx_number, { x: col2X, y: currentY, size: 7, font: helvetica, color: black });
    }
    
    // Package
    if (order.nasal_package) {
      currentY -= rowHeight;
      page.drawText("Package:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
      page.drawText(order.nasal_package, { x: col2X, y: currentY, size: 7, font: helvetica, color: black });
    }
    
    // Billing Date
    if (order.nasal_billing_date) {
      currentY -= rowHeight;
      page.drawText("Billing:", { x: col1X, y: currentY, size: 7, font: helvetica, color: gray });
      page.drawText(formatDate(order.nasal_billing_date), { x: col2X, y: currentY, size: 7, font: helvetica, color: black });
    }
  }
  
  // Dashed divider
  currentY -= 14;
  for (let x = marginLeft; x < width - marginRight; x += 6) {
    page.drawLine({
      start: { x, y: currentY },
      end: { x: x + 3, y: currentY },
      thickness: 1,
      color: lightGray,
    });
  }
  
  // ============================================
  // DATES SECTION (receipt style - aligned)
  // ============================================
  currentY -= 14;
  
  const labelWidth = 90;
  
  // Ordered Date
  page.drawText("Ordered:", {
    x: marginLeft,
    y: currentY,
    size: 8,
    font: helvetica,
    color: gray,
  });
  page.drawText(formatDate(order.order_date), {
    x: marginLeft + labelWidth,
    y: currentY,
    size: 8,
    font: helvetica,
    color: black,
  });
  
  // Shipped Date & Time
  currentY -= 12;
  page.drawText("Shipped:", {
    x: marginLeft,
    y: currentY,
    size: 8,
    font: helvetica,
    color: gray,
  });
  const shippedStr = options.shippedAt ? formatDateTime(options.shippedAt) : formatDate(order.shipping_date);
  page.drawText(shippedStr, {
    x: marginLeft + labelWidth,
    y: currentY,
    size: 8,
    font: helveticaBold,
    color: black,
  });
  
  // Delivered Date & Time
  currentY -= 12;
  page.drawText("Delivered:", {
    x: marginLeft,
    y: currentY,
    size: 8,
    font: helvetica,
    color: gray,
  });
  const deliveredStr = options.deliveredAt ? formatDateTime(options.deliveredAt) : "N/A";
  page.drawText(deliveredStr, {
    x: marginLeft + labelWidth,
    y: currentY,
    size: 8,
    font: helveticaBold,
    color: rgb(0.1, 0.5, 0.1),
  });
  
  // ============================================
  // DELIVERED STAMP (non-distorted, bottom right)
  // ============================================
  if (deliveredStampBytes) {
    try {
      const stampImg = await pdfDoc.embedPng(deliveredStampBytes);
      // Get original dimensions for aspect ratio
      const stampOrigWidth = stampImg.width;
      const stampOrigHeight = stampImg.height;
      const aspectRatio = stampOrigWidth / stampOrigHeight;
      
      // Set stamp size maintaining aspect ratio
      const stampHeight = 50;
      const stampWidth = stampHeight * aspectRatio;
      
      // Position bottom right, above footer
      const stampX = width - marginRight - stampWidth;
      const stampY = 45;
      
      page.drawImage(stampImg, {
        x: stampX,
        y: stampY,
        width: stampWidth,
        height: stampHeight,
      });
    } catch (e) {
      console.error("Failed to embed delivered stamp:", e);
    }
  }
  
  // ============================================
  // FOOTER - Thank you message
  // ============================================
  const footerY = 20;
  
  // Dashed divider above footer
  for (let x = marginLeft; x < width - marginRight; x += 6) {
    page.drawLine({
      start: { x, y: footerY + 18 },
      end: { x: x + 3, y: footerY + 18 },
      thickness: 1,
      color: lightGray,
    });
  }
  
  const thankYou = "Thank you for choosing EndOverdose";
  const thankYouWidth = helvetica.widthOfTextAtSize(thankYou, 8);
  page.drawText(thankYou, {
    x: centerX - thankYouWidth / 2,
    y: footerY,
    size: 8,
    font: helvetica,
    color: gray,
  });
  
  const website = "www.endoverdose.ca";
  const websiteWidth = helvetica.widthOfTextAtSize(website, 7);
  page.drawText(website, {
    x: centerX - websiteWidth / 2,
    y: footerY - 10,
    size: 7,
    font: helvetica,
    color: gray,
  });
}

// Helper to generate a single order's label PDF bytes
async function generateSingleOrderLabelPdf(
  order: CustomOrder,
  options: LabelOptions,
  appLogoBytes: Uint8Array | null,
  fragileBytes: Uint8Array | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  await generateSingleLabel(
    pdfDoc,
    order,
    options,
    helveticaBold,
    helvetica,
    appLogoBytes,
    fragileBytes
  );
  
  return await pdfDoc.save();
}

// Helper to generate a single order's receipt PDF bytes
async function generateSingleOrderReceiptPdf(
  order: CustomOrder,
  options: LabelOptions,
  appLogoBytes: Uint8Array | null,
  deliveredStampBytes: Uint8Array | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  await generateSingleReceipt(
    pdfDoc,
    order,
    options,
    helveticaBold,
    helvetica,
    appLogoBytes,
    deliveredStampBytes
  );
  
  return await pdfDoc.save();
}

// Sanitize filename
function sanitizeFilename(name: string): string {
  return (name || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
}

export async function generateCustomLabels(
  orders: CustomOrder[],
  options: LabelOptions,
  onProgress?: (progress: number) => void
): Promise<void> {
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
  
  // For 'completed' type (Mark Shipped & Delivered), create ZIP with individual order folders
  if (options.type === 'completed') {
    const zip = new JSZip();
    const dateStr = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const clientName = sanitizeFilename(order.client_name || 'Unknown');
      const shipmentId = order.shipment_id || order.id.substring(0, 8);
      const folderName = `${clientName}_${shipmentId}`;
      
      // Generate label PDF
      const labelBytes = await generateSingleOrderLabelPdf(
        order,
        options,
        appLogoBytes,
        fragileBytes
      );
      
      // Generate receipt PDF
      const receiptBytes = await generateSingleOrderReceiptPdf(
        order,
        options,
        appLogoBytes,
        deliveredStampBytes
      );
      
      // Add to ZIP
      zip.file(`${folderName}/label.pdf`, labelBytes);
      zip.file(`${folderName}/receipt.pdf`, receiptBytes);
      
      if (onProgress) {
        onProgress(Math.round(((i + 1) / orders.length) * 90));
      }
    }
    
    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shipped-delivered-orders-${dateStr}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    if (onProgress) {
      onProgress(100);
    }
    return;
  }
  
  // For 'standard' and 'shipped' types, generate combined PDF as before
  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
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
  
  if (onProgress) {
    onProgress(100);
  }
}
