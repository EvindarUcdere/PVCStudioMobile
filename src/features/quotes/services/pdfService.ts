import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getCompanyProfile } from '../../../database/repositories/CompanyProfileRepository';
import { CompanyProfile, defaultCompanyProfile } from '../../../domain/company/entities/CompanyProfile';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { getDesignProfileColor } from '../../../domain/designs/colors/profileColorOptions';
import { calculateDesignLayout } from '../../../domain/designs/layout/calculateDesignLayout';
import { NodeBounds, PanelBounds, SplitBounds } from '../../../domain/designs/layout/layoutTypes';
import { calculateDesignMaterialSummary } from '../../../domain/designs/measurement/calculateDesignMaterialSummary';
import {
  calculateDesignPriceEstimate,
  DesignPriceEstimate,
  PriceEstimateRates,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { collectPanels } from '../../../domain/designs/utils/findNodeById';
import { getArchHeight, isArchTopFrame } from '../../../domain/designs/utils/frameShape';
import { calculateDesignStockNeeds } from '../../../domain/inventory/calculateDesignStockNeeds';
import { StockItem, stockUnitLabels } from '../../../domain/inventory/entities/StockItem';
import { Quote } from '../../../domain/quotes/entities/Quote';
import {
  createReferenceWindowGeometry,
  defaultFrameProfile,
  defaultMullionProfile,
  defaultSashProfile,
  RectMm,
  toPx,
} from '../../design-editor/components/window-drawing/profileGeometry';

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

export type JobProductionPdfInput = {
  jobName: string;
  customerName: string;
  customerPhone: string;
  designs: DesignProject[];
  rates: PriceEstimateRates;
  stockItems: StockItem[];
};

export async function shareCustomerQuotePdf(input: QuotePdfInput | SavedQuotePdfInput): Promise<void> {
  await printAndShare(await buildCustomerQuotePdfHtml(input), 'PVC teklif.pdf');
}

export async function shareProductionPdf(input: QuotePdfInput): Promise<void> {
  await printAndShare(await buildProductionPdfHtml(input), 'PVC imalat formu.pdf');
}

export async function shareJobProductionPdf(input: JobProductionPdfInput): Promise<void> {
  const companyProfile = await getCompanyProfile();
  const html = buildJobProductionHtml(input, companyProfile);
  await printAndShare(html, 'PVC toplu imalat formu.pdf');
}

export async function buildCustomerQuotePdfHtml(input: QuotePdfInput | SavedQuotePdfInput): Promise<string> {
  const companyProfile = await getCompanyProfile();
  return 'quote' in input
    ? buildSavedCustomerQuoteHtml(input.quote, companyProfile)
    : buildCustomerQuoteHtml(input, companyProfile);
}

export async function buildProductionPdfHtml(input: QuotePdfInput): Promise<string> {
  const companyProfile = await getCompanyProfile();
  return buildProductionHtml(input, companyProfile);
}

export async function sharePdfHtml(html: string, dialogTitle: string): Promise<void> {
  await printAndShare(html, dialogTitle);
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
        ['Malzeme karsiligi', formatCurrency(estimate.materialSubtotal)],
        [`Hizmet payi (%${estimate.rates.serviceLaborRate})`, formatCurrency(estimate.serviceLaborSubtotal)],
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
  const profileParts = productionPartSummary(design, summary);

  return pageTemplate({
    title: 'PVC Imalat Formu',
    subtitle: design.name,
    companyProfile,
    body: `
      ${profileBanner(profileParts)}
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
          <div class="kv"><span>Profil sistemi</span><strong>${escapeHtml(profileParts.system)}</strong></div>
          <div class="kv"><span>Fiyat profili</span><strong>${escapeHtml(estimate.selectedProfileSystem.name)}</strong></div>
          <div class="kv"><span>Ana kasa</span><strong>${escapeHtml(profileParts.frame)}</strong></div>
          <div class="kv"><span>Kanat</span><strong>${escapeHtml(profileParts.sash)}</strong></div>
          <div class="kv"><span>Kayit</span><strong>${escapeHtml(profileParts.mullion)}</strong></div>
          <div class="kv"><span>Renk</span><strong>${escapeHtml(estimate.selectedColor.name)}</strong></div>
          <div class="kv"><span>Cam</span><strong>${escapeHtml(estimate.selectedGlassType.name)}</strong></div>
          <div class="kv"><span>Acilim</span><strong>${summary.openingPanelCount} acilir / ${summary.fixedPanelCount} sabit</strong></div>
          <div class="kv"><span>Sineklik</span><strong>${screenCount > 0 ? `${screenCount} panel` : 'Yok'}</strong></div>
          <div class="kv"><span>Panjur</span><strong>${summary.rollerShutterHeight ? `${summary.rollerShutterHeight} mm` : 'Yok'}</strong></div>
          <div class="kv"><span>Kemer</span><strong>${summary.archHeight ? `${summary.archHeight} mm` : 'Yok'}</strong></div>
        </div>
      </div>
      <h2>Tasarim Gorunumu</h2>
      <div class="visual-preview">
        ${buildDesignPreviewSvg(design)}
      </div>
      ${referenceWindowDetailsSection(design)}
      ${note.trim() ? `<div class="note-box"><strong>Not:</strong> ${escapeHtml(note.trim())}</div>` : ''}
      ${section('Genel Tasarim Ozeti', [
        ['Dis olcu', `${design.width} x ${design.height} mm`],
        ['Adet', String(design.quantity)],
        ['Profil sistemi', profileParts.system],
        ['Fiyat profili', estimate.selectedProfileSystem.name],
        ['Profil rengi', `${estimate.selectedColor.name} (${summary.profileColorHex})`],
        ['Cam tipi', `${estimate.selectedGlassType.name} - ${estimate.selectedGlassType.formula}`],
        ['Kasa/kanat payi', `Kasa ${summary.frameWidth} mm, kanat ${summary.sashWidth} mm`],
        ['Kayit/cam payi', `Kayit ${summary.mullionWidth} mm, cam ${summary.glassRebate} mm`],
        ['Panjur alani', summary.rollerShutterHeight ? `${summary.rollerShutterHeight} mm` : 'Yok'],
        ['Kemer yuksekligi', summary.archHeight ? `${summary.archHeight} mm` : 'Yok'],
      ])}
      ${section('Profil ve Kasa Bilgisi', productionProfileRows(design, summary))}
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
        ['Malzeme karsiligi', formatCurrency(estimate.materialSubtotal)],
        [`Hizmet payi (%${estimate.rates.serviceLaborRate})`, formatCurrency(estimate.serviceLaborSubtotal)],
        ['Tahmini teklif', formatCurrency(estimate.total)],
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

function buildJobProductionHtml(
  { jobName, customerName, customerPhone, designs, rates, stockItems }: JobProductionPdfInput,
  companyProfile: CompanyProfile,
): string {
  const designBlocks = designs
    .map((design, index) => {
      const estimate = calculateDesignPriceEstimate(design, rates);
      const summary = calculateDesignMaterialSummary(design);
      const profileParts = productionPartSummary(design, summary);
      const screenCount = summary.panels.filter((panel) => panel.insectScreen).length;
      const panelRows = summary.panels
        .map(
          (panel, panelIndex) => `
            <tr>
              <td>${panelIndex + 1}</td>
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

      return `
        <div class="job-design-block">
          <h2>${index + 1}. ${escapeHtml(design.name)}</h2>
          ${profileBanner(profileParts)}
          <div class="production-grid">
            <div class="production-drawing">
              ${buildDesignSvg(design)}
            </div>
            <div class="production-summary">
              <div class="kv"><span>Adet</span><strong>${design.quantity}</strong></div>
              <div class="kv"><span>Dis olcu</span><strong>${design.width} x ${design.height} mm</strong></div>
              <div class="kv"><span>Profil sistemi</span><strong>${escapeHtml(profileParts.system)}</strong></div>
              <div class="kv"><span>Fiyat profili</span><strong>${escapeHtml(estimate.selectedProfileSystem.name)}</strong></div>
              <div class="kv"><span>Ana kasa</span><strong>${escapeHtml(profileParts.frame)}</strong></div>
              <div class="kv"><span>Kanat</span><strong>${escapeHtml(profileParts.sash)}</strong></div>
              <div class="kv"><span>Kayit</span><strong>${escapeHtml(profileParts.mullion)}</strong></div>
              <div class="kv"><span>Renk</span><strong>${escapeHtml(estimate.selectedColor.name)}</strong></div>
              <div class="kv"><span>Cam</span><strong>${escapeHtml(estimate.selectedGlassType.name)} - ${escapeHtml(estimate.selectedGlassType.formula ?? '-')}</strong></div>
              <div class="kv"><span>Acilim</span><strong>${summary.openingPanelCount} acilir / ${summary.fixedPanelCount} sabit</strong></div>
              <div class="kv"><span>Sineklik</span><strong>${screenCount > 0 ? `${screenCount} panel` : 'Yok'}</strong></div>
              <div class="kv"><span>Panjur</span><strong>${summary.rollerShutterHeight ? `${summary.rollerShutterHeight} mm` : 'Yok'}</strong></div>
              <div class="kv"><span>Kemer</span><strong>${summary.archHeight ? `${summary.archHeight} mm` : 'Yok'}</strong></div>
            </div>
          </div>
          <div class="visual-preview compact-preview">
            ${buildDesignPreviewSvg(design)}
          </div>
          ${referenceWindowDetailsSection(design)}
          ${section('Profil ve Kasa Bilgisi', productionProfileRows(design, summary))}
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
        </div>
      `;
    })
    .join('');
  const totalEstimate = designs.reduce(
    (total, design) => total + calculateDesignPriceEstimate(design, rates).total,
    0,
  );
  const totalMaterial = designs.reduce(
    (total, design) => total + calculateDesignPriceEstimate(design, rates).materialSubtotal * design.quantity,
    0,
  );
  const totalService = designs.reduce(
    (total, design) => total + calculateDesignPriceEstimate(design, rates).serviceLaborSubtotal * design.quantity,
    0,
  );

  return pageTemplate({
    title: 'PVC Toplu Imalat Formu',
    subtitle: jobName,
    companyProfile,
    body: `
      <div class="production-summary job-summary">
        <div class="kv"><span>Is</span><strong>${escapeHtml(jobName)}</strong></div>
        <div class="kv"><span>Musteri</span><strong>${escapeHtml(customerName.trim() || '-')}</strong></div>
        <div class="kv"><span>Telefon</span><strong>${escapeHtml(customerPhone.trim() || '-')}</strong></div>
        <div class="kv"><span>Tasarim sayisi</span><strong>${designs.length}</strong></div>
        <div class="kv"><span>Toplam adet</span><strong>${designs.reduce((sum, design) => sum + design.quantity, 0)}</strong></div>
        <div class="kv"><span>Malzeme karsiligi</span><strong>${formatCurrency(totalMaterial)}</strong></div>
        <div class="kv"><span>Toplam hizmet payi</span><strong>${formatCurrency(totalService)}</strong></div>
        <div class="kv"><span>Tahmini toplam</span><strong>${formatCurrency(totalEstimate)}</strong></div>
      </div>
      ${designBlocks}
      <h2>Toplam Malzeme Ihtiyaci</h2>
      <table>
        <thead>
          <tr>
            <th>Malzeme</th>
            <th>Ihtiyac</th>
            <th>Stok</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>${buildJobMaterialRows(designs, stockItems, rates)}</tbody>
      </table>
      <p class="muted">Bu toplu form is altindaki tum tasarimlar icindir. Kesin kesim ve montaj kararlari saha olcusuyle dogrulanmalidir.</p>
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
          .profile-banner { background: #f6faf7; border: 1px solid #b8d5cb; border-radius: 8px; display: flex; gap: 8px; margin-top: 12px; padding: 10px; }
          .profile-pill { flex: 1; }
          .profile-pill span { color: #60716a; display: block; font-size: 10px; }
          .profile-pill strong { color: #16211d; display: block; font-size: 12px; margin-top: 3px; }
          .production-drawing { background: #ffffff; border: 1px solid #d9e2dc; border-radius: 8px; flex: 1.8; padding: 10px; text-align: center; }
          .production-summary { border: 1px solid #d9e2dc; border-radius: 8px; flex: 1; overflow: hidden; }
          .visual-preview { background: #eef3f0; border: 1px solid #d9e2dc; border-radius: 8px; padding: 10px; text-align: center; }
          .job-summary { margin-top: 14px; }
          .job-design-block { page-break-inside: avoid; margin-top: 18px; }
          .compact-preview { margin-top: 10px; }
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
  const referencePanels = getReferenceWindowPanelsForPdf(design);
  if (referencePanels) {
    return buildReferenceWindowSvg(620, 455, design, true);
  }

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
  const frameProfileThickness = Math.max(10, Math.min(24, summary.frameWidth * layout.scale * 0.82));
  const splitProfileThickness = Math.max(9, Math.min(24, summary.mullionWidth * layout.scale * 0.86));
  const panelNodes = new Map(collectPanels(design.rootNode).map((panel) => [panel.id, panel]));
  const panelMeasurements = new Map(summary.panels.map((panel) => [panel.panelId, panel]));
  const shutterHeight =
    rootFrame?.rollerShutter?.enabled
      ? Math.min(frame.height * 0.34, Math.max(16, rootFrame.rollerShutter.height * layout.scale))
      : 0;

  const panels = layout.panelBounds
    .map((panel, index) => {
      const drawablePanel = getDrawablePanelBoundsForPdf(panel, frame, frameProfileThickness, splitProfileThickness);
      const panelNode = panelNodes.get(panel.nodeId);
      const measurement = panelMeasurements.get(panel.nodeId);
      const hasSash = drawablePanel.openingType !== 'fixed';
      const sashInset = Math.max(7, Math.min(17, Math.min(drawablePanel.width, drawablePanel.height) * 0.09));
      const effectiveInset = hasSash ? sashInset + 6 : glassInset;
      const x = round(drawablePanel.x + effectiveInset);
      const y = round(drawablePanel.y + effectiveInset);
      const width = round(Math.max(8, drawablePanel.width - effectiveInset * 2));
      const height = round(Math.max(8, drawablePanel.height - effectiveInset * 2));
      const openingBounds = getOpeningSymbolBoundsForPdf(drawablePanel);
      const opening = buildOpeningSymbol(
        drawablePanel.openingType,
        openingBounds.x,
        openingBounds.y,
        openingBounds.width,
        openingBounds.height,
      );
      const insectScreen = panelNode?.insectScreen ? buildInsectScreenSymbol(drawablePanel, effectiveInset) : '';
      const glassLabel = measurement ? `${measurement.glassWidth} * ${measurement.glassHeight}` : '';
      const panelLabel = `${index + 1}`;

      return `
        ${hasSash ? buildProfiledPanelSvg(drawablePanel.x + 4, drawablePanel.y + 4, drawablePanel.width - 8, drawablePanel.height - 8, sashInset, profileColor) : ''}
        <rect x="${round(x - 3)}" y="${round(y - 3)}" width="${round(width + 6)}" height="${round(height + 6)}" fill="none" stroke="${mixHexForPdf('#17211e', profileColor, 0.18)}" stroke-width="1.4" />
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#pdfGlassGradient)" stroke="#aebbb7" stroke-width="1.2" />
        ${buildGlassUnitDetailSvg(x, y, width, height, profileColor)}
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
    .map((split) => buildSplitProfileSvg(split, splitProfileThickness, profileColor))
    .join('');

  return `
    <svg class="design-svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pdfGlassGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#a7ddf2" stop-opacity="0.88" />
          <stop offset="0.5" stop-color="#f4fcfe" stop-opacity="0.98" />
          <stop offset="1" stop-color="#c2eaf8" stop-opacity="0.9" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" rx="10" fill="#eef3f0" />
      ${!isArch ? buildGenericMountingFrameSvg(frame.x, frame.y, frame.width, frame.height, frameProfileThickness, profileColor) : ''}
      ${
        isArch
          ? `<path d="${framePath}" fill="#f8fbf9" stroke="${profileColor}" stroke-width="${frameStroke}" />`
          : `<rect x="${round(frame.x)}" y="${round(frame.y)}" width="${round(frame.width)}" height="${round(frame.height)}" fill="#f8fbf9" stroke="${profileColor}" stroke-width="${frameStroke}" />`
      }
      ${shutterHeight > 0 ? buildRollerShutterSvg(frame.x, frame.y, frame.width, shutterHeight) : ''}
      ${panels}
      ${splits}
      ${buildFrameProfileSvg(frame.x, frame.y, frame.width, frame.height, frameProfileThickness, profileColor, isArch ? framePath : null, isArch ? buildArchFramePath(frame.x + frameProfileThickness, frame.y + frameProfileThickness, frame.width - frameProfileThickness * 2, frame.height - frameProfileThickness * 2, Math.max(20, archHeight - frameProfileThickness)) : null)}
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

function buildDesignPreviewSvg(design: DesignProject): string {
  const referencePanels = getReferenceWindowPanelsForPdf(design);
  if (referencePanels) {
    return buildReferenceWindowSvg(520, 300, design, false);
  }

  const canvasWidth = 520;
  const canvasHeight = 300;
  const layout = calculateDesignLayout({
    rootNode: design.rootNode,
    designWidth: design.width,
    designHeight: design.height,
    canvasWidth,
    canvasHeight,
    padding: 40,
  });
  const profileColor = getDesignProfileColor(design.profileSystem).hexValue;
  const summary = calculateDesignMaterialSummary(design);
  const frame = layout.frameBounds;
  const rootFrame = design.rootNode.type === 'frame' ? design.rootNode : null;
  const isArch = rootFrame ? isArchTopFrame(rootFrame) : false;
  const archHeight = isArch && rootFrame ? getArchHeight(rootFrame, design.height) * layout.scale : 0;
  const framePath = isArch ? buildArchFramePath(frame.x, frame.y, frame.width, frame.height, archHeight) : '';
  const frameProfileThickness = Math.max(9, Math.min(22, summary.frameWidth * layout.scale * 0.82));
  const splitProfileThickness = Math.max(8, Math.min(22, summary.mullionWidth * layout.scale * 0.86));
  const panelNodes = new Map(collectPanels(design.rootNode).map((panel) => [panel.id, panel]));
  const shutterHeight =
    rootFrame?.rollerShutter?.enabled
      ? Math.min(frame.height * 0.34, Math.max(16, rootFrame.rollerShutter.height * layout.scale))
      : 0;

  const panels = layout.panelBounds
    .map((panel) => {
      const drawablePanel = getDrawablePanelBoundsForPdf(panel, frame, frameProfileThickness, splitProfileThickness);
      const panelNode = panelNodes.get(panel.nodeId);
      const hasSash = drawablePanel.openingType !== 'fixed';
      const profileInset = Math.max(5, Math.min(13, Math.min(drawablePanel.width, drawablePanel.height) * 0.08));
      const glassInset = hasSash
        ? profileInset + Math.max(3, Math.min(7, Math.min(drawablePanel.width, drawablePanel.height) * 0.04))
        : Math.max(7, Math.min(12, Math.min(drawablePanel.width, drawablePanel.height) * 0.06));
      const glassX = round(drawablePanel.x + glassInset);
      const glassY = round(drawablePanel.y + glassInset);
      const glassWidth = round(Math.max(0, drawablePanel.width - glassInset * 2));
      const glassHeight = round(Math.max(0, drawablePanel.height - glassInset * 2));
      const openingBounds = getOpeningSymbolBoundsForPdf(drawablePanel);

      return `
        ${hasSash ? buildProfiledPanelSvg(drawablePanel.x + 3, drawablePanel.y + 3, drawablePanel.width - 6, drawablePanel.height - 6, profileInset, profileColor) : ''}
        <rect x="${round(glassX - 3)}" y="${round(glassY - 3)}" width="${round(glassWidth + 6)}" height="${round(glassHeight + 6)}" fill="none" stroke="${mixHexForPdf('#17211e', profileColor, 0.18)}" stroke-width="1.3" />
        <rect x="${glassX}" y="${glassY}" width="${glassWidth}" height="${glassHeight}" fill="url(#pdfGlassGradient)" stroke="#aebbb7" stroke-width="1.2" />
        ${buildGlassUnitDetailSvg(glassX, glassY, glassWidth, glassHeight, profileColor)}
        ${panelNode?.insectScreen ? buildInsectScreenSymbol(drawablePanel, glassInset) : ''}
        ${buildOpeningSymbol(drawablePanel.openingType, openingBounds.x, openingBounds.y, openingBounds.width, openingBounds.height)}
      `;
    })
    .join('');

  const splits = layout.splitBounds
    .map((split) => buildSplitProfileSvg(split, splitProfileThickness, profileColor))
    .join('');

  return `
    <svg class="design-svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" rx="10" fill="#eef3f0" />
      ${!isArch ? buildGenericMountingFrameSvg(frame.x, frame.y, frame.width, frame.height, frameProfileThickness, profileColor) : ''}
      ${
        isArch
          ? `<path d="${framePath}" fill="#f8fbf9" stroke="${profileColor}" stroke-width="9" />`
          : `<rect x="${round(frame.x)}" y="${round(frame.y)}" width="${round(frame.width)}" height="${round(frame.height)}" fill="#f8fbf9" stroke="${profileColor}" stroke-width="9" />`
      }
      ${shutterHeight > 0 ? buildRollerShutterSvg(frame.x, frame.y, frame.width, shutterHeight) : ''}
      ${panels}
      ${splits}
      ${buildFrameProfileSvg(frame.x, frame.y, frame.width, frame.height, frameProfileThickness, profileColor, isArch ? framePath : null, isArch ? buildArchFramePath(frame.x + frameProfileThickness, frame.y + frameProfileThickness, frame.width - frameProfileThickness * 2, frame.height - frameProfileThickness * 2, Math.max(20, archHeight - frameProfileThickness)) : null)}
      ${
        isArch
          ? `<path d="${framePath}" fill="none" stroke="#24302c" stroke-width="2" />`
          : `<rect x="${round(frame.x)}" y="${round(frame.y)}" width="${round(frame.width)}" height="${round(frame.height)}" fill="none" stroke="#24302c" stroke-width="2" />`
      }
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

function getReferenceWindowPanelsForPdf(design: DesignProject): { leftPanelId: string; rightPanelId: string } | null {
  const rootChild = design.rootNode.type === 'frame' ? design.rootNode.child : design.rootNode;

  if (design.width !== 1400 || design.height !== 1400 || rootChild.type !== 'split') {
    return null;
  }

  if (rootChild.direction !== 'vertical' || Math.abs(rootChild.ratio - 0.5) > 0.02) {
    return null;
  }

  if (rootChild.first.type !== 'panel' || rootChild.second.type !== 'panel') {
    return null;
  }

  if (rootChild.first.openingType !== 'fixed' || rootChild.second.openingType === 'fixed') {
    return null;
  }

  return {
    leftPanelId: rootChild.first.id,
    rightPanelId: rootChild.second.id,
  };
}

function referenceWindowDetailsSection(design: DesignProject): string {
  if (!getReferenceWindowPanelsForPdf(design)) {
    return '';
  }

  return section('Referans Kasa Detayi', [
    [
      'Montaj sirasi',
      'Once duvara gomulu ana kasa, sonra orta T kayit, sabit cam ve acilir kanat yerlesir.',
    ],
    ['Ana kasa', `${defaultFrameProfile.faceWidthMm} mm; duvar acikliginin icinde dis cerceve`],
    ['Orta T kayit', `${defaultMullionProfile.faceWidthMm} mm; modul alanindan gercek genisligi dusulur`],
    ['Sol bolum', 'Sabit cam; kanat profili yok, cam citasi ve conta ile tutulur'],
    ['Sag bolum', `${defaultSashProfile.faceWidthMm} mm kanat profili; hafif onde gosterilen acilir kanat`],
    ['Cam yapisi', 'Isicam 4+16+4 referans gosterimi; kesin cam formulu profil sisteminden dogrulanmalidir'],
  ]);
}

function buildReferenceWindowSvg(width: number, height: number, design: DesignProject, includeDimensions: boolean): string {
  const geometry = createReferenceWindowGeometry(width, height);
  const profileColor = getDesignProfileColor(design.profileSystem).hexValue;
  const wallOpening = toPx(geometry.wallOpening, geometry);
  const frameOuter = toPx(geometry.frameOuter, geometry);
  const frameInner = toPx(geometry.frameInner, geometry);
  const mullion = toPx(geometry.mullion, geometry);
  const leftModule = toPx(geometry.leftModule, geometry);
  const rightModule = toPx(geometry.rightModule, geometry);
  const leftGlass = toPx(geometry.leftGlass, geometry);
  const rightSashOuter = toPx(geometry.rightSashOuter, geometry);
  const rightSashInner = toPx(geometry.rightSashInner, geometry);
  const rightGlass = toPx(geometry.rightGlass, geometry);

  return `
    <svg class="design-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="referencePdfGlassGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#a7ddf2" stop-opacity="0.9" />
          <stop offset="0.48" stop-color="#f6fcfe" stop-opacity="0.98" />
          <stop offset="1" stop-color="#c2eaf8" stop-opacity="0.94" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="#eef2ef" />
      ${buildReferenceMountingFrameSvg(wallOpening, frameOuter, geometry.scale)}
      ${buildReferenceFrameSvg(frameOuter, frameInner, profileColor)}
      ${buildReferenceMullionSvg(mullion, profileColor)}
      ${buildReferenceFixedGlassSvg(leftGlass)}
      ${buildReferenceSashSvg(rightSashOuter, rightSashInner, rightGlass, profileColor)}
      ${buildReferenceOpeningSvg(rightSashOuter)}
      ${
        includeDimensions
          ? `
            ${buildHorizontalDimension(frameOuter.x, frameOuter.x + frameOuter.width, frameOuter.y + frameOuter.height + 22, '1400')}
            ${buildVerticalDimension(frameOuter.x - 24, frameOuter.y, frameOuter.y + frameOuter.height, '1400')}
            ${buildHorizontalDimension(mullion.x, mullion.x + mullion.width, frameOuter.y + frameOuter.height + 44, `${defaultMullionProfile.faceWidthMm}`)}
            ${buildHorizontalDimension(leftModule.x, leftModule.x + leftModule.width, frameOuter.y + frameOuter.height + 66, `${Math.round(geometry.leftModule.width)}`)}
            ${buildHorizontalDimension(rightModule.x, rightModule.x + rightModule.width, frameOuter.y + frameOuter.height + 66, `${Math.round(geometry.rightModule.width)}`)}
          `
          : ''
      }
      <text x="${round(frameOuter.x - 16)}" y="${round(frameOuter.y - 9)}" font-size="9" font-weight="700" fill="#16211d">Duvara gomulu montaj kasasi</text>
      <text x="${round(frameOuter.x + 8)}" y="${round(frameOuter.y + 16)}" font-size="10" font-weight="700" fill="#16211d">Ana kasa ${defaultFrameProfile.faceWidthMm} mm</text>
      <text x="${round(mullion.x - 8)}" y="${round(mullion.y + 18)}" text-anchor="end" font-size="9" fill="#16211d">Orta T kayit ${defaultMullionProfile.faceWidthMm} mm</text>
      <text x="${round(leftGlass.x + leftGlass.width / 2)}" y="${round(leftGlass.y + leftGlass.height / 2)}" text-anchor="middle" font-size="10" font-weight="700" fill="#21413a">Sabit cam</text>
      <text x="${round(rightSashOuter.x + 8)}" y="${round(rightSashOuter.y + 16)}" font-size="9" fill="#16211d">Acilir kanat ${defaultSashProfile.faceWidthMm} mm</text>
      <text x="${round(rightGlass.x + rightGlass.width / 2)}" y="${round(rightGlass.y + rightGlass.height / 2 + 16)}" text-anchor="middle" font-size="9" fill="#21413a">Isicam 4+16+4</text>
    </svg>
  `;
}

function buildReferenceMountingFrameSvg(wallOpening: RectMm, frameOuter: RectMm, scale: number): string {
  const reveal = 24 * scale;
  const tapeInset = 10 * scale;

  return `
    <rect x="${wallOpening.x}" y="${wallOpening.y}" width="${wallOpening.width}" height="${wallOpening.height}" fill="#d8ddd9" stroke="#a8b0ac" stroke-width="1" />
    <rect x="${frameOuter.x - reveal}" y="${frameOuter.y - reveal}" width="${frameOuter.width + reveal * 2}" height="${frameOuter.height + reveal * 2}" fill="#303735" stroke="#111816" stroke-width="1.2" />
    <rect x="${frameOuter.x - tapeInset}" y="${frameOuter.y - tapeInset}" width="${frameOuter.width + tapeInset * 2}" height="${frameOuter.height + tapeInset * 2}" fill="#151c1a" stroke="#5b6460" stroke-width="0.8" />
  `;
}

function buildGenericMountingFrameSvg(
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  profileColor: string,
): string {
  const reveal = Math.max(8, Math.min(18, thickness * 0.75));
  const tapeInset = Math.max(3, Math.min(8, thickness * 0.32));
  const wallColor = mixHexForPdf(profileColor, '#17211e', 0.58);
  const seatColor = mixHexForPdf(profileColor, '#17211e', 0.74);

  return `
    <rect x="${round(x - reveal)}" y="${round(y - reveal)}" width="${round(width + reveal * 2)}" height="${round(height + reveal * 2)}" fill="${wallColor}" opacity="0.28" />
    <rect x="${round(x - tapeInset)}" y="${round(y - tapeInset)}" width="${round(width + tapeInset * 2)}" height="${round(height + tapeInset * 2)}" fill="${seatColor}" opacity="0.42" />
  `;
}

function buildReferenceFrameSvg(outer: RectMm, inner: RectMm, color: string): string {
  return `
    <polygon points="${outer.x},${outer.y} ${outer.x + outer.width},${outer.y} ${inner.x + inner.width},${inner.y} ${inner.x},${inner.y}" fill="#ffffff" stroke="#4d5753" stroke-width="1.1" />
    <polygon points="${outer.x + outer.width},${outer.y} ${outer.x + outer.width},${outer.y + outer.height} ${inner.x + inner.width},${inner.y + inner.height} ${inner.x + inner.width},${inner.y}" fill="#b8c1bd" stroke="#4d5753" stroke-width="1.1" />
    <polygon points="${outer.x},${outer.y + outer.height} ${outer.x + outer.width},${outer.y + outer.height} ${inner.x + inner.width},${inner.y + inner.height} ${inner.x},${inner.y + inner.height}" fill="#b8c1bd" stroke="#4d5753" stroke-width="1.1" />
    <polygon points="${outer.x},${outer.y} ${inner.x},${inner.y} ${inner.x},${inner.y + inner.height} ${outer.x},${outer.y + outer.height}" fill="${color}" stroke="#4d5753" stroke-width="1.1" />
    <rect x="${inner.x}" y="${inner.y}" width="${inner.width}" height="${inner.height}" fill="#f6faf7" stroke="#8d9894" stroke-width="1" />
  `;
}

function buildReferenceMullionSvg(rect: RectMm, color: string): string {
  return `
    <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${color}" stroke="#4d5753" stroke-width="1.1" />
    <rect x="${rect.x + rect.width * 0.18}" y="${rect.y + 6}" width="${rect.width * 0.64}" height="${rect.height - 12}" fill="#eef3f0" stroke="#8d9894" stroke-width="0.8" />
    <line x1="${rect.x + rect.width / 2}" y1="${rect.y + 5}" x2="${rect.x + rect.width / 2}" y2="${rect.y + rect.height - 5}" stroke="#b34032" stroke-width="2" />
  `;
}

function buildReferenceFixedGlassSvg(glass: RectMm): string {
  return `
    <rect x="${glass.x - 5}" y="${glass.y - 5}" width="${glass.width + 10}" height="${glass.height + 10}" fill="none" stroke="#dfe6e2" stroke-width="5" />
    <rect x="${glass.x - 3}" y="${glass.y - 3}" width="${glass.width + 6}" height="${glass.height + 6}" fill="none" stroke="#1d2a26" stroke-opacity="0.6" stroke-width="1.2" />
    <rect x="${glass.x}" y="${glass.y}" width="${glass.width}" height="${glass.height}" fill="url(#referencePdfGlassGradient)" stroke="#89a7af" stroke-width="1.2" />
    <rect x="${glass.x + 5}" y="${glass.y + 5}" width="${glass.width - 10}" height="${glass.height - 10}" fill="none" stroke="#48635f" stroke-opacity="0.42" stroke-width="0.8" />
  `;
}

function buildReferenceSashSvg(outer: RectMm, inner: RectMm, glass: RectMm, color: string): string {
  const liftX = Math.max(2, Math.min(6, outer.width * 0.03));
  const liftY = Math.max(1.5, Math.min(4, outer.height * 0.018));
  const liftedOuter = offsetPdfRect(outer, liftX, liftY);
  const liftedInner = offsetPdfRect(inner, liftX, liftY);
  const liftedGlass = offsetPdfRect(glass, liftX, liftY);

  return `
    <rect x="${outer.x + liftX * 0.35}" y="${outer.y + liftY * 0.35}" width="${outer.width}" height="${outer.height}" fill="#101816" opacity="0.18" />
    <polygon points="${outer.x},${outer.y} ${liftedOuter.x},${liftedOuter.y} ${liftedOuter.x},${
      liftedOuter.y + liftedOuter.height
    } ${outer.x},${outer.y + outer.height}" fill="#d9e0dc" stroke="#4d5753" stroke-width="0.8" />
    <polygon points="${outer.x},${outer.y + outer.height} ${liftedOuter.x},${liftedOuter.y + liftedOuter.height} ${
      liftedOuter.x + liftedOuter.width
    },${liftedOuter.y + liftedOuter.height} ${outer.x + outer.width},${outer.y + outer.height}" fill="#aab4b0" stroke="#4d5753" stroke-width="0.8" />
    <polygon points="${liftedOuter.x},${liftedOuter.y} ${liftedOuter.x + liftedOuter.width},${liftedOuter.y} ${
      liftedInner.x + liftedInner.width
    },${liftedInner.y} ${liftedInner.x},${liftedInner.y}" fill="#ffffff" stroke="#4d5753" stroke-width="1" />
    <polygon points="${liftedOuter.x + liftedOuter.width},${liftedOuter.y} ${liftedOuter.x + liftedOuter.width},${
      liftedOuter.y + liftedOuter.height
    } ${liftedInner.x + liftedInner.width},${liftedInner.y + liftedInner.height} ${
      liftedInner.x + liftedInner.width
    },${liftedInner.y}" fill="#c8d0cc" stroke="#4d5753" stroke-width="1" />
    <polygon points="${liftedOuter.x},${liftedOuter.y + liftedOuter.height} ${liftedOuter.x + liftedOuter.width},${
      liftedOuter.y + liftedOuter.height
    } ${liftedInner.x + liftedInner.width},${liftedInner.y + liftedInner.height} ${liftedInner.x},${
      liftedInner.y + liftedInner.height
    }" fill="#b9c2be" stroke="#4d5753" stroke-width="1" />
    <polygon points="${liftedOuter.x},${liftedOuter.y} ${liftedInner.x},${liftedInner.y} ${liftedInner.x},${
      liftedInner.y + liftedInner.height
    } ${liftedOuter.x},${liftedOuter.y + liftedOuter.height}" fill="${color}" stroke="#4d5753" stroke-width="1" />
    <rect x="${liftedGlass.x - 5}" y="${liftedGlass.y - 5}" width="${liftedGlass.width + 10}" height="${liftedGlass.height + 10}" fill="none" stroke="#dfe6e2" stroke-width="5" />
    <rect x="${liftedGlass.x - 3}" y="${liftedGlass.y - 3}" width="${liftedGlass.width + 6}" height="${liftedGlass.height + 6}" fill="none" stroke="#1d2a26" stroke-opacity="0.6" stroke-width="1.2" />
    <rect x="${liftedGlass.x}" y="${liftedGlass.y}" width="${liftedGlass.width}" height="${liftedGlass.height}" fill="url(#referencePdfGlassGradient)" stroke="#89a7af" stroke-width="1.2" />
    <rect x="${liftedGlass.x + 5}" y="${liftedGlass.y + 5}" width="${liftedGlass.width - 10}" height="${liftedGlass.height - 10}" fill="none" stroke="#48635f" stroke-opacity="0.42" stroke-width="0.8" />
  `;
}

function buildReferenceOpeningSvg(sash: RectMm): string {
  const liftX = Math.max(2, Math.min(6, sash.width * 0.03));
  const liftY = Math.max(1.5, Math.min(4, sash.height * 0.018));
  const liftedSash = offsetPdfRect(sash, liftX, liftY);

  return `
    <path d="M ${liftedSash.x + liftedSash.width - 8} ${liftedSash.y + 8} L ${liftedSash.x + 10} ${
      liftedSash.y + liftedSash.height / 2
    } L ${liftedSash.x + liftedSash.width - 8} ${liftedSash.y + liftedSash.height - 8}" fill="none" stroke="#1747ff" stroke-width="1.8" />
    <rect x="${liftedSash.x + 8}" y="${liftedSash.y + liftedSash.height / 2 - 18}" width="5" height="36" rx="2.5" fill="#6f7b78" stroke="#e6efeb" stroke-width="0.8" />
  `;
}

function offsetPdfRect(rect: RectMm, x: number, y: number): RectMm {
  return {
    ...rect,
    x: rect.x + x,
    y: rect.y + y,
  };
}

function buildGlassUnitDetailSvg(
  x: number,
  y: number,
  width: number,
  height: number,
  profileColor: string,
): string {
  const edgeOffset = Math.max(3, Math.min(7, Math.min(width, height) * 0.045));
  const shineOffset = Math.max(8, Math.min(18, Math.min(width, height) * 0.16));
  const gasket = mixHexForPdf('#17211e', profileColor, 0.18);

  return `
    <rect x="${round(x + edgeOffset)}" y="${round(y + edgeOffset)}" width="${round(Math.max(0, width - edgeOffset * 2))}" height="${round(Math.max(0, height - edgeOffset * 2))}" fill="none" stroke="${gasket}" stroke-opacity="0.45" stroke-width="0.8" />
    <line x1="${round(x + shineOffset)}" y1="${round(y + 4)}" x2="${round(x + width - 4)}" y2="${round(y + height - shineOffset)}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.2" />
  `;
}

function getDrawablePanelBoundsForPdf(
  panel: PanelBounds,
  frame: NodeBounds,
  frameThickness: number,
  splitThickness: number,
): PanelBounds {
  const tolerance = 0.8;
  const frameRight = frame.x + frame.width;
  const frameBottom = frame.y + frame.height;
  const panelRight = panel.x + panel.width;
  const panelBottom = panel.y + panel.height;
  const halfSplit = Math.max(4, splitThickness / 2);
  const leftTrim = Math.abs(panel.x - frame.x) <= tolerance ? frameThickness : halfSplit;
  const rightTrim = Math.abs(panelRight - frameRight) <= tolerance ? frameThickness : halfSplit;
  const topTrim = Math.abs(panel.y - frame.y) <= tolerance ? frameThickness : halfSplit;
  const bottomTrim = Math.abs(panelBottom - frameBottom) <= tolerance ? frameThickness : halfSplit;

  return {
    ...panel,
    x: panel.x + leftTrim,
    y: panel.y + topTrim,
    width: Math.max(1, panel.width - leftTrim - rightTrim),
    height: Math.max(1, panel.height - topTrim - bottomTrim),
  };
}

function getOpeningSymbolBoundsForPdf(panel: PanelBounds): PanelBounds {
  const inset = Math.max(8, Math.min(18, Math.min(panel.width, panel.height) * 0.08));

  return {
    ...panel,
    x: round(panel.x + inset),
    y: round(panel.y + inset),
    width: round(Math.max(1, panel.width - inset * 2)),
    height: round(Math.max(1, panel.height - inset * 2)),
  };
}

function buildProfiledPanelSvg(
  x: number,
  y: number,
  width: number,
  height: number,
  inset: number,
  profileColor: string,
): string {
  const left = round(x);
  const top = round(y);
  const right = round(x + width);
  const bottom = round(y + height);
  const innerLeft = round(x + inset);
  const innerTop = round(y + inset);
  const innerRight = round(x + width - inset);
  const innerBottom = round(y + height - inset);
  const base = mixHexForPdf(profileColor, '#ffffff', 0.84);
  const light = mixHexForPdf(base, '#ffffff', 0.5);
  const mid = mixHexForPdf(base, '#d9dedc', 0.35);
  const shadow = mixHexForPdf(base, '#7f8985', 0.18);

  return `
    <polygon points="${left},${top} ${right},${top} ${innerRight},${innerTop} ${innerLeft},${innerTop}" fill="${light}" stroke="#4c5753" stroke-width="1.1" />
    <polygon points="${right},${top} ${right},${bottom} ${innerRight},${innerBottom} ${innerRight},${innerTop}" fill="${shadow}" stroke="#4c5753" stroke-width="1.1" />
    <polygon points="${left},${bottom} ${right},${bottom} ${innerRight},${innerBottom} ${innerLeft},${innerBottom}" fill="${shadow}" stroke="#4c5753" stroke-width="1.1" />
    <polygon points="${left},${top} ${innerLeft},${innerTop} ${innerLeft},${innerBottom} ${left},${bottom}" fill="${mid}" stroke="#4c5753" stroke-width="1.1" />
    <rect x="${innerLeft}" y="${innerTop}" width="${round(Math.max(0, innerRight - innerLeft))}" height="${round(Math.max(0, innerBottom - innerTop))}" fill="none" stroke="#a0aaa6" stroke-width="1" />
    <rect x="${round(innerLeft + inset * 0.18)}" y="${round(innerTop + inset * 0.18)}" width="${round(Math.max(0, innerRight - innerLeft - inset * 0.36))}" height="${round(Math.max(0, innerBottom - innerTop - inset * 0.36))}" fill="none" stroke="${mixHexForPdf(profileColor, '#24302c', 0.22)}" stroke-opacity="0.7" stroke-width="0.8" />
    <line x1="${round(x + 4)}" y1="${round(y + 4)}" x2="${innerLeft}" y2="${innerTop}" stroke="#4c5753" stroke-width="0.8" />
    <line x1="${round(x + width - 4)}" y1="${round(y + 4)}" x2="${innerRight}" y2="${innerTop}" stroke="#4c5753" stroke-width="0.8" />
    <line x1="${round(x + 4)}" y1="${round(y + height - 4)}" x2="${innerLeft}" y2="${innerBottom}" stroke="#4c5753" stroke-width="0.8" />
    <line x1="${round(x + width - 4)}" y1="${round(y + height - 4)}" x2="${innerRight}" y2="${innerBottom}" stroke="#4c5753" stroke-width="0.8" />
  `;
}

function buildFrameProfileSvg(
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  profileColor: string,
  archPath: string | null,
  innerArchPath: string | null,
): string {
  const base = mixHexForPdf(profileColor, '#ffffff', 0.24);
  const light = mixHexForPdf(base, '#ffffff', 0.72);
  const mid = mixHexForPdf(base, '#d9dedc', 0.38);
  const shadow = mixHexForPdf(base, '#7f8985', 0.28);
  const stroke = mixHexForPdf(profileColor, '#17211e', 0.35);

  if (archPath) {
    return `
      <path d="${archPath}" fill="none" stroke="${base}" stroke-width="${round(thickness)}" stroke-linejoin="round" />
      <path d="${archPath}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round" />
      ${innerArchPath ? `<path d="${innerArchPath}" fill="none" stroke="${light}" stroke-width="1.8" stroke-linejoin="round" />` : ''}
    `;
  }

  return buildBeveledFrameSvg(x, y, width, height, thickness, light, mid, shadow, stroke);
}

function buildBeveledFrameSvg(
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  light: string,
  mid: string,
  shadow: string,
  stroke: string,
): string {
  const inset = Math.min(thickness, Math.min(width, height) * 0.18);
  const left = round(x);
  const top = round(y);
  const right = round(x + width);
  const bottom = round(y + height);
  const innerLeft = round(x + inset);
  const innerTop = round(y + inset);
  const innerRight = round(x + width - inset);
  const innerBottom = round(y + height - inset);

  return `
    <polygon points="${left},${top} ${right},${top} ${innerRight},${innerTop} ${innerLeft},${innerTop}" fill="${light}" stroke="${stroke}" stroke-width="1.2" />
    <polygon points="${right},${top} ${right},${bottom} ${innerRight},${innerBottom} ${innerRight},${innerTop}" fill="${mid}" stroke="${stroke}" stroke-width="1.2" />
    <polygon points="${left},${bottom} ${right},${bottom} ${innerRight},${innerBottom} ${innerLeft},${innerBottom}" fill="${shadow}" stroke="${stroke}" stroke-width="1.2" />
    <polygon points="${left},${top} ${innerLeft},${innerTop} ${innerLeft},${innerBottom} ${left},${bottom}" fill="${mid}" stroke="${stroke}" stroke-width="1.2" />
    <rect x="${innerLeft}" y="${innerTop}" width="${round(Math.max(0, innerRight - innerLeft))}" height="${round(Math.max(0, innerBottom - innerTop))}" fill="none" stroke="${light}" stroke-width="1.1" />
    <rect x="${round(innerLeft + inset * 0.22)}" y="${round(innerTop + inset * 0.22)}" width="${round(Math.max(0, innerRight - innerLeft - inset * 0.44))}" height="${round(Math.max(0, innerBottom - innerTop - inset * 0.44))}" fill="none" stroke="${mixHexForPdf(stroke, '#ffffff', 0.18)}" stroke-opacity="0.7" stroke-width="0.8" />
    ${buildFrameReinforcementMarkersSvg(x, y, width, height, inset)}
  `;
}

function buildFrameReinforcementMarkersSvg(
  x: number,
  y: number,
  width: number,
  height: number,
  inset: number,
): string {
  const markerLength = Math.max(12, Math.min(34, Math.min(width, height) * 0.16));
  const markerWidth = Math.max(2, Math.min(4, inset * 0.22));
  const cx = x + width / 2;
  const cy = y + height / 2;

  return `
    <g opacity="0.72">
      <rect x="${round(cx - markerLength / 2)}" y="${round(y + inset * 0.38)}" width="${round(markerLength)}" height="${round(markerWidth)}" fill="#b34032" />
      <rect x="${round(cx - markerLength / 2)}" y="${round(y + height - inset * 0.38 - markerWidth)}" width="${round(markerLength)}" height="${round(markerWidth)}" fill="#b34032" />
      <rect x="${round(x + inset * 0.38)}" y="${round(cy - markerLength / 2)}" width="${round(markerWidth)}" height="${round(markerLength)}" fill="#b34032" />
      <rect x="${round(x + width - inset * 0.38 - markerWidth)}" y="${round(cy - markerLength / 2)}" width="${round(markerWidth)}" height="${round(markerLength)}" fill="#b34032" />
    </g>
  `;
}

function buildSplitProfileSvg(split: SplitBounds, thickness: number, profileColor: string): string {
  const base = mixHexForPdf(profileColor, '#ffffff', 0.24);
  const light = mixHexForPdf(base, '#ffffff', 0.72);
  const mid = mixHexForPdf(base, '#d9dedc', 0.38);
  const shadow = mixHexForPdf(base, '#7f8985', 0.28);
  const stroke = mixHexForPdf(profileColor, '#17211e', 0.35);
  const half = thickness / 2;

  if (split.direction === 'vertical') {
    const x = split.dividerX1 - half;

    return `
      <rect x="${round(x)}" y="${round(split.dividerY1)}" width="${round(thickness)}" height="${round(split.dividerY2 - split.dividerY1)}" fill="${mid}" stroke="${stroke}" stroke-width="1.2" />
      <line x1="${round(x + 3)}" y1="${round(split.dividerY1 + 4)}" x2="${round(x + 3)}" y2="${round(split.dividerY2 - 4)}" stroke="${light}" stroke-width="1.1" />
      <line x1="${round(x + thickness - 3)}" y1="${round(split.dividerY1 + 4)}" x2="${round(x + thickness - 3)}" y2="${round(split.dividerY2 - 4)}" stroke="${shadow}" stroke-width="1.1" />
      <line x1="${round(split.dividerX1)}" y1="${round(split.dividerY1 + 5)}" x2="${round(split.dividerX1)}" y2="${round(split.dividerY2 - 5)}" stroke="${mixHexForPdf(stroke, '#ffffff', 0.18)}" stroke-width="0.8" />
    `;
  }

  const y = split.dividerY1 - half;

  return `
    <rect x="${round(split.dividerX1)}" y="${round(y)}" width="${round(split.dividerX2 - split.dividerX1)}" height="${round(thickness)}" fill="${mid}" stroke="${stroke}" stroke-width="1.2" />
    <line x1="${round(split.dividerX1 + 4)}" y1="${round(y + 3)}" x2="${round(split.dividerX2 - 4)}" y2="${round(y + 3)}" stroke="${light}" stroke-width="1.1" />
    <line x1="${round(split.dividerX1 + 4)}" y1="${round(y + thickness - 3)}" x2="${round(split.dividerX2 - 4)}" y2="${round(y + thickness - 3)}" stroke="${shadow}" stroke-width="1.1" />
    <line x1="${round(split.dividerX1 + 5)}" y1="${round(split.dividerY1)}" x2="${round(split.dividerX2 - 5)}" y2="${round(split.dividerY1)}" stroke="${mixHexForPdf(stroke, '#ffffff', 0.18)}" stroke-width="0.8" />
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
  const stroke = '#1747ff';
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

type PdfMaterialSummary = ReturnType<typeof calculateDesignMaterialSummary>;

function productionProfileRows(
  design: DesignProject,
  summary: PdfMaterialSummary = calculateDesignMaterialSummary(design),
): [string, string][] {
  const parts = productionPartSummary(design, summary);
  const profileSystem = design.profileSystem;

  if (!profileSystem?.productionProfileSystemId) {
    return [
      ['Profil sistemi', parts.system],
      ['Teknik durum', 'Profil Kutuphanesi secilmedi; mevcut tasarim olculerinden yaklasik bilgi gosteriliyor'],
      ['Ana kasa', parts.frame],
      ['Kanat', parts.sash],
      ['Orta kayit', parts.mullion],
      ['Yatay / T kayit', parts.transom],
      ['Cam citasi', parts.glazingBead],
      ['Conta', parts.gasket],
      ['Aksesuar seti', parts.hardwareSet],
    ];
  }

  return [
    [
      'Profil sistemi',
      parts.system,
    ],
    ['Durum', profileSystem.productionProfileSystemStatus ?? '-'],
    ['Ana kasa', parts.frame],
    ['Kanat', parts.sash],
    ['Orta kayit', parts.mullion],
    ['Yatay / T kayit', parts.transom],
    ['Cam citasi', parts.glazingBead],
    ['Conta', parts.gasket],
    ['Aksesuar seti', parts.hardwareSet],
  ];
}

function profileBanner(parts: ReturnType<typeof productionPartSummary>): string {
  return `
    <div class="profile-banner">
      <div class="profile-pill">
        <span>Profil sistemi</span>
        <strong>${escapeHtml(parts.system)}</strong>
      </div>
      <div class="profile-pill">
        <span>Ana kasa</span>
        <strong>${escapeHtml(parts.frame)}</strong>
      </div>
      <div class="profile-pill">
        <span>Kanat / kayit</span>
        <strong>${escapeHtml(`${parts.sash} | ${parts.mullion}`)}</strong>
      </div>
    </div>
  `;
}

function productionPartSummary(design: DesignProject, summary: PdfMaterialSummary) {
  const profileSystem = design.profileSystem;
  const hasOpeningPanel = summary.openingPanelCount > 0;
  const systemName = profileSystem?.productionProfileSystemId
    ? `${profileSystem.productionProfileSystemName ?? profileSystem.productionProfileSystemId} v${
        profileSystem.productionProfileSystemVersion ?? '-'
      }`
    : `${summary.profileName} (yaklasik)`;

  return {
    system: systemName,
    frame: partValue(profileSystem?.productionFrameProfileCode, `Kasa ${summary.frameWidth} mm; kod secilmedi`),
    sash: hasOpeningPanel
      ? partValue(profileSystem?.productionSashProfileCode, `Kanat ${summary.sashWidth} mm; kod secilmedi`)
      : partValue(profileSystem?.productionSashProfileCode, 'Bu tasarimda acilir kanat yok'),
    mullion: partValue(profileSystem?.productionMullionProfileCode, `Orta kayit ${summary.mullionWidth} mm; kod secilmedi`),
    transom: partValue(profileSystem?.productionTransomProfileCode, `Yatay/T kayit ${summary.mullionWidth} mm; kod secilmedi`),
    glazingBead: partValue(profileSystem?.productionGlazingBeadProfileCode, `Cam payi ${summary.glassRebate} mm; citasi kodu secilmedi`),
    gasket: partValue(profileSystem?.productionGasketCode, 'Kod secilmedi'),
    hardwareSet: partValue(profileSystem?.productionHardwareSetCode, 'Kod secilmedi'),
  };
}

function partValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
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

function buildJobMaterialRows(
  designs: DesignProject[],
  stockItems: StockItem[],
  rates: PriceEstimateRates,
): string {
  const totals = new Map<
    string,
    {
      label: string;
      requiredQuantity: number;
      availableQuantity: number;
      unit: StockItem['unit'];
      missingQuantity: number;
    }
  >();

  designs.forEach((design) => {
    calculateDesignStockNeeds(design, stockItems, rates).forEach((need) => {
      const key = `${need.type}:${need.unit}`;
      const existing = totals.get(key);

      if (existing) {
        existing.requiredQuantity += need.requiredQuantity;
        existing.missingQuantity = Math.max(0, existing.requiredQuantity - existing.availableQuantity);
        return;
      }

      totals.set(key, {
        label: need.type === 'pvc_profile' ? 'PVC profil' : need.label,
        requiredQuantity: need.requiredQuantity,
        availableQuantity: need.availableQuantity,
        missingQuantity: need.missingQuantity,
        unit: need.unit,
      });
    });
  });

  if (totals.size === 0) {
    return '<tr><td colspan="4">Malzeme ihtiyaci bulunamadi.</td></tr>';
  }

  return Array.from(totals.values())
    .map((item) => {
      const status =
        item.missingQuantity > 0
          ? `Eksik ${formatQuantityForPdf(item.missingQuantity, item.unit)}`
          : 'Yeterli';

      return `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${formatQuantityForPdf(item.requiredQuantity, item.unit)}</td>
          <td>${formatQuantityForPdf(item.availableQuantity, item.unit)}</td>
          <td>${status}</td>
        </tr>
      `;
    })
    .join('');
}

function formatQuantityForPdf(value: number, unit: StockItem['unit']): string {
  return `${roundQuantityForPdf(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${stockUnitLabels[unit]}`;
}

function roundQuantityForPdf(value: number): number {
  return Math.round(value * 100) / 100;
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

function mixHexForPdf(firstHex: string, secondHex: string, ratio: number): string {
  const first = parseHexForPdf(firstHex);
  const second = parseHexForPdf(secondHex);
  const safeRatio = Math.max(0, Math.min(1, ratio));

  return toHexForPdf({
    r: Math.round(first.r * (1 - safeRatio) + second.r * safeRatio),
    g: Math.round(first.g * (1 - safeRatio) + second.g * safeRatio),
    b: Math.round(first.b * (1 - safeRatio) + second.b * safeRatio),
  });
}

function parseHexForPdf(hexValue: string): { r: number; g: number; b: number } {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hexValue) ? hexValue.slice(1) : 'FFFFFF';

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHexForPdf({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
