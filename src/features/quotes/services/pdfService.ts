import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getCompanyProfile } from '../../../database/repositories/CompanyProfileRepository';
import { CompanyProfile, defaultCompanyProfile } from '../../../domain/company/entities/CompanyProfile';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { getDesignProfileColor } from '../../../domain/designs/colors/profileColorOptions';
import { calculateDesignLayout } from '../../../domain/designs/layout/calculateDesignLayout';
import { PanelBounds } from '../../../domain/designs/layout/layoutTypes';
import { calculateDesignMaterialSummary } from '../../../domain/designs/measurement/calculateDesignMaterialSummary';
import { DesignPriceEstimate } from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { collectPanels } from '../../../domain/designs/utils/findNodeById';
import { getArchHeight, isArchTopFrame } from '../../../domain/designs/utils/frameShape';
import { Quote } from '../../../domain/quotes/entities/Quote';

export type QuotePdfInput = {
  design: DesignProject;
  estimate: DesignPriceEstimate;
  customerName: string;
  customerPhone: string;
  note: string;
};

export type SavedQuotePdfInput = {
  quote: Quote;
};

export async function shareCustomerQuotePdf(input: QuotePdfInput | SavedQuotePdfInput): Promise<void> {
  const companyProfile = await getCompanyProfile();
  const html =
    'quote' in input
      ? buildSavedCustomerQuoteHtml(input.quote, companyProfile)
      : buildCustomerQuoteHtml(input, companyProfile);
  await printAndShare(html, 'PVC teklif.pdf');
}

export async function shareProductionPdf(input: QuotePdfInput): Promise<void> {
  const companyProfile = await getCompanyProfile();
  const html = buildProductionHtml(input, companyProfile);
  await printAndShare(html, 'PVC imalat formu.pdf');
}

async function printAndShare(html: string, dialogTitle: string): Promise<void> {
  const result = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      dialogTitle,
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  }
}

function buildCustomerQuoteHtml({
  design,
  estimate,
  customerName,
  customerPhone,
  note,
}: QuotePdfInput, companyProfile: CompanyProfile): string {
  return pageTemplate({
    title: 'PVC Teklif Formu',
    subtitle: design.name,
    companyProfile,
    body: `
      ${customerBlock(customerName, customerPhone, note)}
      ${totalBlock(estimate.total)}
      ${section('Tasarim Bilgileri', [
        ['Olcu', `${design.width} x ${design.height} mm`],
        ['Adet', String(design.quantity)],
        ['Profil kalitesi', estimate.selectedProfileSystem.name],
        ['Renk', estimate.selectedColor.name],
        ['Cam tipi', estimate.selectedGlassType.name],
        ['Birim fiyat', formatCurrency(estimate.unitTotal)],
        ['Toplam', formatCurrency(estimate.total)],
      ])}
      ${section('Fiyat Dokumu', [
        ['Profil tutari', formatCurrency(estimate.profileSubtotal)],
        ['Cam tutari', formatCurrency(estimate.glassSubtotal)],
        ['Aksam/kayit', formatCurrency(estimate.hardwareSubtotal)],
        ['Kemer farki', formatCurrency(estimate.archSubtotal)],
      ])}
      <p class="muted">${escapeHtml(companyProfile.pdfNote || defaultCompanyProfile.pdfNote)}</p>
      <p class="muted">Teklif gecerlilik suresi: ${companyProfile.quoteValidityDays} gun.</p>
    `,
  });
}

function buildSavedCustomerQuoteHtml(quote: Quote, companyProfile: CompanyProfile): string {
  return pageTemplate({
    title: 'PVC Teklif Formu',
    subtitle: quote.designName,
    companyProfile,
    body: `
      ${customerBlock(quote.customerName ?? '', quote.customerPhone ?? '', quote.note ?? '')}
      ${totalBlock(quote.total)}
      ${section('Tasarim Bilgileri', [
        ['Olcu', `${quote.width} x ${quote.height} mm`],
        ['Adet', String(quote.quantity)],
        ['Profil kalitesi', quote.profileSystemName],
        ['Renk', quote.colorName],
        ['Cam tipi', quote.glassTypeName],
        ['Birim fiyat', formatCurrency(quote.unitTotal)],
        ['Toplam', formatCurrency(quote.total)],
        ['Durum', quote.status],
      ])}
      <p class="muted">Bu teklif kaydedildigi andaki fiyatlarla olusturulmustur.</p>
    `,
  });
}

function buildProductionHtml(
  { design, estimate, customerName, customerPhone, note }: QuotePdfInput,
  companyProfile: CompanyProfile,
): string {
  const summary = calculateDesignMaterialSummary(design);
  const panelRows = summary.panels
    .map(
      (panel, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${openingLabel(panel.openingType)}</td>
          <td>${panel.panelWidth} x ${panel.panelHeight}</td>
          <td>${panel.glassWidth} x ${panel.glassHeight}</td>
          <td>${panel.estimatedCutWidth} x ${panel.estimatedCutHeight}</td>
          <td>${panel.usesSash ? 'Kanatli' : 'Sabit'}</td>
          <td>${panel.insectScreen ? insectScreenLabel(panel.insectScreen) : 'Yok'}</td>
        </tr>
      `,
    )
    .join('');
  const screenCount = summary.panels.filter((panel) => panel.insectScreen).length;

  return pageTemplate({
    title: 'PVC Imalat Formu',
    subtitle: design.name,
    companyProfile,
    body: `
      <div class="production-grid">
        <div class="production-drawing">
          ${buildDesignSvg(design)}
        </div>
        <div class="production-summary">
          <div class="kv"><span>Item</span><strong>${escapeHtml(design.name)}</strong></div>
          <div class="kv"><span>Qty</span><strong>${design.quantity}</strong></div>
          <div class="kv"><span>Musteri</span><strong>${escapeHtml(customerName.trim() || '-')}</strong></div>
          <div class="kv"><span>Telefon</span><strong>${escapeHtml(customerPhone.trim() || '-')}</strong></div>
          <div class="kv"><span>Dis olcu</span><strong>${design.width} x ${design.height} mm</strong></div>
          <div class="kv"><span>Profil</span><strong>${escapeHtml(estimate.selectedProfileSystem.name)}</strong></div>
          <div class="kv"><span>Renk</span><strong>${escapeHtml(estimate.selectedColor.name)}</strong></div>
          <div class="kv"><span>Cam</span><strong>${escapeHtml(estimate.selectedGlassType.name)}</strong></div>
          <div class="kv"><span>Acilim</span><strong>${summary.openingPanelCount} acilir / ${summary.fixedPanelCount} sabit</strong></div>
          <div class="kv"><span>Sineklik</span><strong>${screenCount > 0 ? `${screenCount} panel` : 'Yok'}</strong></div>
          <div class="kv"><span>Panjur</span><strong>${summary.rollerShutterHeight ? `${summary.rollerShutterHeight} mm` : 'Yok'}</strong></div>
          <div class="kv"><span>Kemer</span><strong>${summary.archHeight ? `${summary.archHeight} mm` : 'Yok'}</strong></div>
        </div>
      </div>
      ${note.trim() ? `<div class="note-box"><strong>Not:</strong> ${escapeHtml(note.trim())}</div>` : ''}
      ${section('Genel Tasarim Ozeti', [
        ['Dis olcu', `${design.width} x ${design.height} mm`],
        ['Adet', String(design.quantity)],
        ['Profil kalitesi', estimate.selectedProfileSystem.name],
        ['Profil rengi', `${estimate.selectedColor.name} (${summary.profileColorHex})`],
        ['Cam tipi', `${estimate.selectedGlassType.name} - ${estimate.selectedGlassType.formula}`],
        ['Kasa/kanat payi', `Kasa ${summary.frameWidth} mm, kanat ${summary.sashWidth} mm`],
        ['Kayit/cam payi', `Kayit ${summary.mullionWidth} mm, cam ${summary.glassRebate} mm`],
        ['Panjur alani', summary.rollerShutterHeight ? `${summary.rollerShutterHeight} mm` : 'Yok'],
        ['Kemer yuksekligi', summary.archHeight ? `${summary.archHeight} mm` : 'Yok'],
      ])}
      <h2>Panel ve Cam Kesim Listesi</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Acilim</th>
            <th>Panel mm</th>
            <th>Cam mm</th>
            <th>Tahmini kesim mm</th>
            <th>Tip</th>
            <th>Sineklik</th>
          </tr>
        </thead>
        <tbody>${panelRows}</tbody>
      </table>
      ${section('Uretim Notlari', [
        ['Toplam profil', `${estimate.profileLengthMeters} m`],
        ['Toplam cam alani', `${estimate.glassAreaSquareMeters} m2`],
        ['Panel sayisi', String(summary.panelCount)],
        ['Acilir panel', String(summary.openingPanelCount)],
        ['Sabit panel', String(summary.fixedPanelCount)],
        ['Sineklikli panel', String(screenCount)],
      ])}
      <p class="muted">Bu form imalat hazirligi icindir. Kesin kesim ve montaj kararlari saha olcusuyle dogrulanmalidir.</p>
    `,
    productionMode: true,
  });
}

function pageTemplate({
  title,
  subtitle,
  companyProfile,
  body,
  productionMode = false,
}: {
  title: string;
  subtitle: string;
  companyProfile: CompanyProfile;
  body: string;
  productionMode?: boolean;
}): string {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { color: #16211d; font-family: Arial, sans-serif; margin: ${productionMode ? '18px' : '28px'}; }
          h1 { font-size: ${productionMode ? '22px' : '26px'}; margin: 0; }
          h2 { border-bottom: 1px solid #d9e2dc; font-size: 16px; margin: 18px 0 8px; padding-bottom: 5px; }
          .subtitle { color: #60716a; margin-top: 4px; }
          .meta { color: #60716a; font-size: 12px; margin-top: 8px; }
          .company { background: #f6faf7; border: 1px solid #d9e2dc; border-radius: 8px; margin-bottom: 14px; padding: 10px 12px; }
          .company-name { font-size: 18px; font-weight: 700; }
          .company-detail { color: #60716a; font-size: 12px; margin-top: 3px; }
          .total { background: #157A69; border-radius: 8px; color: white; margin: 18px 0; padding: 16px; }
          .total .label { font-size: 12px; opacity: 0.9; }
          .total .value { font-size: 30px; font-weight: 700; margin-top: 4px; }
          .section { border: 1px solid #d9e2dc; border-radius: 8px; margin-top: 12px; overflow: hidden; }
          .row { display: flex; border-bottom: 1px solid #edf2ef; }
          .row:last-child { border-bottom: 0; }
          .key { background: #f6faf7; color: #60716a; flex: 1; padding: 9px 11px; }
          .val { flex: 1.4; font-weight: 700; padding: 9px 11px; text-align: right; }
          .muted { color: #60716a; font-size: 12px; margin-top: 18px; }
          table { border-collapse: collapse; margin-top: 8px; width: 100%; }
          th, td { border: 1px solid #d9e2dc; font-size: 12px; padding: 8px; text-align: left; }
          th { background: #f6faf7; color: #60716a; }
          .production-grid { align-items: flex-start; display: flex; gap: 14px; margin-top: 16px; }
          .production-drawing { background: #ffffff; border: 1px solid #d9e2dc; border-radius: 8px; flex: 1.8; padding: 10px; text-align: center; }
          .production-summary { border: 1px solid #d9e2dc; border-radius: 8px; flex: 1; overflow: hidden; }
          .kv { display: flex; border-bottom: 1px solid #edf2ef; font-size: 11px; }
          .kv:last-child { border-bottom: 0; }
          .kv span { background: #f6faf7; color: #60716a; flex: 0.8; padding: 7px; }
          .kv strong { flex: 1.2; padding: 7px; text-align: right; }
          .note-box { border: 1px solid #d9e2dc; border-radius: 8px; font-size: 12px; margin-top: 10px; padding: 10px; }
          .drawing { background: #f4f7f5; border: 1px solid #d9e2dc; border-radius: 8px; margin-top: 18px; padding: 18px; text-align: center; }
          .design-svg { max-width: 100%; }
          @page { margin: 16px; }
        </style>
      </head>
      <body>
        ${companyBlock(companyProfile)}
        <h1>${escapeHtml(title)}</h1>
        <div class="subtitle">${escapeHtml(subtitle)}</div>
        <div class="meta">Tarih: ${new Date().toLocaleDateString('tr-TR')}</div>
        ${body}
      </body>
    </html>
  `;
}

function companyBlock(companyProfile: CompanyProfile): string {
  if (!companyProfile.companyName && !companyProfile.ownerName && !companyProfile.phone && !companyProfile.address) {
    return '';
  }

  return `
    <div class="company">
      <div class="company-name">${escapeHtml(companyProfile.companyName || 'Firma')}</div>
      ${companyProfile.ownerName ? `<div class="company-detail">Yetkili: ${escapeHtml(companyProfile.ownerName)}</div>` : ''}
      ${companyProfile.phone ? `<div class="company-detail">Telefon: ${escapeHtml(companyProfile.phone)}</div>` : ''}
      ${companyProfile.address ? `<div class="company-detail">Adres: ${escapeHtml(companyProfile.address)}</div>` : ''}
      ${companyProfile.taxInfo ? `<div class="company-detail">${escapeHtml(companyProfile.taxInfo)}</div>` : ''}
    </div>
  `;
}

function buildDesignSvg(design: DesignProject): string {
  const canvasWidth = 620;
  const canvasHeight = 455;
  const summary = calculateDesignMaterialSummary(design);
  const layout = calculateDesignLayout({
    rootNode: design.rootNode,
    designWidth: design.width,
    designHeight: design.height,
    canvasWidth,
    canvasHeight,
    padding: 78,
  });
  const profileColor = getDesignProfileColor(design.profileSystem).hexValue;
  const frame = layout.frameBounds;
  const rootFrame = design.rootNode.type === 'frame' ? design.rootNode : null;
  const isArch = rootFrame ? isArchTopFrame(rootFrame) : false;
  const archHeight = isArch && rootFrame ? getArchHeight(rootFrame, design.height) * layout.scale : 0;
  const framePath = isArch ? buildArchFramePath(frame.x, frame.y, frame.width, frame.height, archHeight) : '';
  const frameStroke = 8;
  const glassInset = 12;
  const splitStroke = 8;
  const panelNodes = new Map(collectPanels(design.rootNode).map((panel) => [panel.id, panel]));
  const panelMeasurements = new Map(summary.panels.map((panel) => [panel.panelId, panel]));
  const shutterHeight =
    rootFrame?.rollerShutter?.enabled
      ? Math.min(frame.height * 0.34, Math.max(16, rootFrame.rollerShutter.height * layout.scale))
      : 0;

  const panels = layout.panelBounds
    .map((panel, index) => {
      const panelNode = panelNodes.get(panel.nodeId);
      const measurement = panelMeasurements.get(panel.nodeId);
      const x = round(panel.x + glassInset);
      const y = round(panel.y + glassInset);
      const width = round(Math.max(8, panel.width - glassInset * 2));
      const height = round(Math.max(8, panel.height - glassInset * 2));
      const opening = buildOpeningSymbol(panel.openingType, x, y, width, height);
      const insectScreen = panelNode?.insectScreen ? buildInsectScreenSymbol(panel, glassInset) : '';
      const glassLabel = measurement ? `${measurement.glassWidth} * ${measurement.glassHeight}` : '';
      const panelLabel = `${index + 1}`;

      return `
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#d7e8f8" stroke="#879a93" stroke-width="2" />
        ${insectScreen}
        ${opening}
        <circle cx="${round(x + width / 2)}" cy="${round(y + height / 2)}" r="2.5" fill="#16211d" />
        <text x="${round(x + width / 2)}" y="${round(y + height / 2 - 8)}" text-anchor="middle" font-size="10" font-weight="700" fill="#16211d">${escapeHtml(glassLabel)}</text>
        <text x="${round(x + 8)}" y="${round(y + 14)}" font-size="10" font-weight="700" fill="#16211d">P${panelLabel}</text>
        ${buildHorizontalDimension(panel.x, panel.x + panel.width, frame.y + frame.height + 42 + index * 4, `${Math.round(panel.realWidth)}`)}
      `;
    })
    .join('');

  const splits = layout.splitBounds
    .map((split) => {
      const x1 = round(split.dividerX1);
      const y1 = round(split.dividerY1);
      const x2 = round(split.dividerX2);
      const y2 = round(split.dividerY2);

      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${profileColor}" stroke-width="${splitStroke}" stroke-linecap="square" />`;
    })
    .join('');

  return `
    <svg class="design-svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" rx="10" fill="#eef3f0" />
      ${
        isArch
          ? `<path d="${framePath}" fill="#f8fbf9" stroke="${profileColor}" stroke-width="${frameStroke}" />`
          : `<rect x="${round(frame.x)}" y="${round(frame.y)}" width="${round(frame.width)}" height="${round(frame.height)}" fill="#f8fbf9" stroke="${profileColor}" stroke-width="${frameStroke}" />`
      }
      ${shutterHeight > 0 ? buildRollerShutterSvg(frame.x, frame.y, frame.width, shutterHeight) : ''}
      ${panels}
      ${splits}
      ${
        isArch
          ? `<path d="${framePath}" fill="none" stroke="#24302c" stroke-width="2" />`
          : `<rect x="${round(frame.x)}" y="${round(frame.y)}" width="${round(frame.width)}" height="${round(frame.height)}" fill="none" stroke="#24302c" stroke-width="2" />`
      }
      <line x1="${round(frame.x)}" y1="${round(frame.y + frame.height + 22)}" x2="${round(frame.x + frame.width)}" y2="${round(frame.y + frame.height + 22)}" stroke="#16211d" stroke-width="1" />
      <text x="${round(frame.x + frame.width / 2)}" y="${round(frame.y + frame.height + 38)}" text-anchor="middle" font-size="12" fill="#16211d">${design.width} mm</text>
      <line x1="${round(frame.x - 24)}" y1="${round(frame.y)}" x2="${round(frame.x - 24)}" y2="${round(frame.y + frame.height)}" stroke="#16211d" stroke-width="1" />
      <text x="${round(frame.x - 34)}" y="${round(frame.y + frame.height / 2)}" transform="rotate(-90 ${round(frame.x - 34)} ${round(frame.y + frame.height / 2)})" text-anchor="middle" font-size="12" fill="#16211d">${design.height} mm</text>
      ${shutterHeight > 0 && rootFrame?.rollerShutter ? buildVerticalDimension(frame.x + frame.width + 28, frame.y, frame.y + shutterHeight, `Panjur ${rootFrame.rollerShutter.height} mm`) : ''}
      ${isArch ? buildVerticalDimension(frame.x + frame.width + 48, frame.y, frame.y + Math.min(archHeight, frame.height * 0.46), `Kemer ${Math.round(archHeight / Math.max(layout.scale, 0.001))} mm`) : ''}
      ${buildPanelHeightDimensions(layout.panelBounds, frame.x - 52)}
    </svg>
  `;
}

function buildArchFramePath(x: number, y: number, width: number, height: number, archHeight: number): string {
  const safeArchHeight = Math.min(height * 0.46, width / 2, Math.max(20, archHeight));
  const bodyTop = y + safeArchHeight;
  const centerX = x + width / 2;

  return [
    `M ${round(x)} ${round(y + height)}`,
    `L ${round(x)} ${round(bodyTop)}`,
    `C ${round(x)} ${round(y + safeArchHeight * 0.45)} ${round(x + width * 0.24)} ${round(y)} ${round(centerX)} ${round(y)}`,
    `C ${round(x + width * 0.76)} ${round(y)} ${round(x + width)} ${round(y + safeArchHeight * 0.45)} ${round(x + width)} ${round(bodyTop)}`,
    `L ${round(x + width)} ${round(y + height)}`,
    'Z',
  ].join(' ');
}

function buildRollerShutterSvg(x: number, y: number, width: number, height: number): string {
  const lineCount = Math.max(3, Math.floor(height / 9));
  const lines = Array.from(
    { length: lineCount },
    (_, index) =>
      `<line x1="${round(x + 10)}" y1="${round(y + ((index + 1) * height) / (lineCount + 1))}" x2="${round(x + width - 10)}" y2="${round(y + ((index + 1) * height) / (lineCount + 1))}" stroke="#8A9693" stroke-width="1" />`,
  ).join('');

  return `<rect x="${round(x + 5)}" y="${round(y + 5)}" width="${round(width - 10)}" height="${round(height - 10)}" fill="#c9d0cf" stroke="#6f7b78" stroke-width="1.5" />${lines}`;
}

function buildInsectScreenSymbol(panel: PanelBounds, inset: number): string {
  const x = round(panel.x + inset + 2);
  const y = round(panel.y + inset + 2);
  const width = round(Math.max(0, panel.width - (inset + 2) * 2));
  const height = round(Math.max(0, panel.height - (inset + 2) * 2));
  const meshOne = round(x + width / 3);
  const meshTwo = round(x + (width * 2) / 3);

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#166e61" stroke-width="1.6" stroke-dasharray="5 4" />
    <line x1="${meshOne}" y1="${round(y + 3)}" x2="${meshOne}" y2="${round(y + height - 3)}" stroke="#166e61" stroke-width="1" opacity="0.35" />
    <line x1="${meshTwo}" y1="${round(y + 3)}" x2="${meshTwo}" y2="${round(y + height - 3)}" stroke="#166e61" stroke-width="1" opacity="0.35" />
  `;
}

function buildVerticalDimension(x: number, y1: number, y2: number, label: string): string {
  const midY = (y1 + y2) / 2;

  return `
    <line x1="${round(x)}" y1="${round(y1)}" x2="${round(x)}" y2="${round(y2)}" stroke="#16211d" stroke-width="1" />
    <line x1="${round(x - 5)}" y1="${round(y1)}" x2="${round(x + 5)}" y2="${round(y1)}" stroke="#16211d" stroke-width="1" />
    <line x1="${round(x - 5)}" y1="${round(y2)}" x2="${round(x + 5)}" y2="${round(y2)}" stroke="#16211d" stroke-width="1" />
    <rect x="${round(x - 34)}" y="${round(midY - 9)}" width="68" height="18" rx="4" fill="#ffffff" stroke="#d9e2dc" />
    <text x="${round(x)}" y="${round(midY + 4)}" text-anchor="middle" font-size="9" fill="#16211d">${escapeHtml(label)}</text>
  `;
}

function buildHorizontalDimension(x1: number, x2: number, y: number, label: string): string {
  const midX = (x1 + x2) / 2;

  return `
    <line x1="${round(x1)}" y1="${round(y)}" x2="${round(x2)}" y2="${round(y)}" stroke="#16211d" stroke-width="1" />
    <line x1="${round(x1)}" y1="${round(y - 5)}" x2="${round(x1)}" y2="${round(y + 5)}" stroke="#16211d" stroke-width="1" />
    <line x1="${round(x2)}" y1="${round(y - 5)}" x2="${round(x2)}" y2="${round(y + 5)}" stroke="#16211d" stroke-width="1" />
    <rect x="${round(midX - 22)}" y="${round(y - 9)}" width="44" height="17" rx="4" fill="#ffffff" stroke="#d9e2dc" />
    <text x="${round(midX)}" y="${round(y + 4)}" text-anchor="middle" font-size="10" fill="#16211d">${escapeHtml(label)}</text>
  `;
}

function buildPanelHeightDimensions(panels: PanelBounds[], x: number): string {
  return panels
    .map((panel, index) =>
      buildVerticalDimension(
        x - (index % 3) * 12,
        panel.y,
        panel.y + panel.height,
        String(Math.round(panel.realHeight)),
      ),
    )
    .join('');
}

function buildOpeningSymbol(openingType: string, x: number, y: number, width: number, height: number): string {
  const stroke = '#1f7a69';
  const cx = round(x + width / 2);
  const cy = round(y + height / 2);

  if (openingType === 'fixed') {
    return '';
  }

  if (openingType === 'open-left' || openingType === 'tilt-turn-left') {
    const swing = `<polyline points="${x},${y} ${round(x + width)},${cy} ${x},${round(y + height)}" fill="none" stroke="${stroke}" stroke-width="2" />`;
    const handle = `<rect x="${round(x + width - 8)}" y="${round(cy - 12)}" width="3" height="24" rx="1.5" fill="${stroke}" />`;
    const tilt = openingType === 'tilt-turn-left' ? `<polyline points="${x},${round(y + height)} ${cx},${y} ${round(x + width)},${round(y + height)}" fill="none" stroke="${stroke}" stroke-width="1.5" opacity="0.7" />` : '';
    return `${swing}${tilt}${handle}`;
  }

  if (openingType === 'open-right' || openingType === 'tilt-turn-right') {
    const swing = `<polyline points="${round(x + width)},${y} ${x},${cy} ${round(x + width)},${round(y + height)}" fill="none" stroke="${stroke}" stroke-width="2" />`;
    const handle = `<rect x="${round(x + 5)}" y="${round(cy - 12)}" width="3" height="24" rx="1.5" fill="${stroke}" />`;
    const tilt = openingType === 'tilt-turn-right' ? `<polyline points="${x},${round(y + height)} ${cx},${y} ${round(x + width)},${round(y + height)}" fill="none" stroke="${stroke}" stroke-width="1.5" opacity="0.7" />` : '';
    return `${swing}${tilt}${handle}`;
  }

  if (openingType === 'tilt-top') {
    return `<polyline points="${x},${y} ${cx},${round(y + height)} ${round(x + width)},${y}" fill="none" stroke="${stroke}" stroke-width="2" />`;
  }

  if (openingType === 'tilt-bottom') {
    return `<polyline points="${x},${round(y + height)} ${cx},${y} ${round(x + width)},${round(y + height)}" fill="none" stroke="${stroke}" stroke-width="2" />`;
  }

  if (openingType === 'sliding-left' || openingType === 'sliding-right') {
    const startX = openingType === 'sliding-left' ? x + width * 0.72 : x + width * 0.28;
    const endX = openingType === 'sliding-left' ? x + width * 0.28 : x + width * 0.72;
    const head = openingType === 'sliding-left' ? 7 : -7;

    return `
      <line x1="${round(startX)}" y1="${cy}" x2="${round(endX)}" y2="${cy}" stroke="${stroke}" stroke-width="3" />
      <polyline points="${round(endX + head)},${round(cy - 7)} ${round(endX)},${cy} ${round(endX + head)},${round(cy + 7)}" fill="none" stroke="${stroke}" stroke-width="3" />
    `;
  }

  return `<line x1="${x}" y1="${y}" x2="${round(x + width)}" y2="${round(y + height)}" stroke="${stroke}" stroke-width="2" />`;
}

function totalBlock(total: number): string {
  return `
    <div class="total">
      <div class="label">Tahmini toplam</div>
      <div class="value">${formatCurrency(total)}</div>
    </div>
  `;
}

function customerBlock(customerName: string, customerPhone: string, note: string): string {
  return section('Musteri Bilgisi', [
    ['Musteri', customerName.trim() || '-'],
    ['Telefon', customerPhone.trim() || '-'],
    ['Not', note.trim() || '-'],
  ]);
}

function section(title: string, rows: [string, string][]): string {
  return `
    <h2>${escapeHtml(title)}</h2>
    <div class="section">
      ${rows
        .map(
          ([key, value]) => `
            <div class="row">
              <div class="key">${escapeHtml(key)}</div>
              <div class="val">${escapeHtml(value)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function openingLabel(value: string): string {
  const labels: Record<string, string> = {
    fixed: 'Sabit',
    'open-left': 'Sol acilir',
    'open-right': 'Sag acilir',
    'tilt-top': 'Vasistas alt',
    'tilt-bottom': 'Vasistas ust',
    'tilt-turn-left': 'Sol cift acilim',
    'tilt-turn-right': 'Sag cift acilim',
    'sliding-left': 'Surme sol',
    'sliding-right': 'Surme sag',
  };

  return labels[value] ?? value;
}

function insectScreenLabel(value: string): string {
  const labels: Record<string, string> = {
    fixed: 'Sabit',
    'sliding-horizontal': 'Surme sag/sol',
    'sliding-vertical': 'Surme yukari',
  };

  return labels[value] ?? value;
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('tr-TR')} TL`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
