import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { calculateDesignMaterialSummary } from '../../../domain/designs/measurement/calculateDesignMaterialSummary';
import { DesignPriceEstimate } from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
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
  const html = 'quote' in input ? buildSavedCustomerQuoteHtml(input.quote) : buildCustomerQuoteHtml(input);
  await printAndShare(html, 'PVC teklif.pdf');
}

export async function shareProductionPdf(input: QuotePdfInput): Promise<void> {
  const html = buildProductionHtml(input);
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
}: QuotePdfInput): string {
  return pageTemplate({
    title: 'PVC Teklif Formu',
    subtitle: design.name,
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
      <p class="muted">Bu teklif on tahmindir. Kesin fiyat, yerinde olcu ve nihai malzeme seciminden sonra netlesir.</p>
    `,
  });
}

function buildSavedCustomerQuoteHtml(quote: Quote): string {
  return pageTemplate({
    title: 'PVC Teklif Formu',
    subtitle: quote.designName,
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

function buildProductionHtml({ design, estimate, customerName, customerPhone, note }: QuotePdfInput): string {
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
        </tr>
      `,
    )
    .join('');

  return pageTemplate({
    title: 'PVC Imalat Formu',
    subtitle: design.name,
    body: `
      ${customerBlock(customerName, customerPhone, note)}
      <div class="drawing">
        <div class="frame">
          <div class="frame-title">${design.name}</div>
          <div class="frame-size">${design.width} x ${design.height} mm</div>
          <div class="frame-grid">${summary.panels.map((_, index) => `<span>${index + 1}</span>`).join('')}</div>
        </div>
      </div>
      ${section('Genel Olcu ve Malzeme', [
        ['Dis olcu', `${design.width} x ${design.height} mm`],
        ['Adet', String(design.quantity)],
        ['Profil kalitesi', estimate.selectedProfileSystem.name],
        ['Profil rengi', estimate.selectedColor.name],
        ['Cam tipi', estimate.selectedGlassType.name],
        ['Kasa/kanat payi', `Kasa ${summary.frameWidth} mm, kanat ${summary.sashWidth} mm`],
        ['Kayit/cam payi', `Kayit ${summary.mullionWidth} mm, cam ${summary.glassRebate} mm`],
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
      ])}
      <p class="muted">Bu form imalat hazirligi icindir. Kesin kesim ve montaj kararlari saha olcusuyle dogrulanmalidir.</p>
    `,
  });
}

function pageTemplate({ title, subtitle, body }: { title: string; subtitle: string; body: string }): string {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { color: #16211d; font-family: Arial, sans-serif; margin: 28px; }
          h1 { font-size: 26px; margin: 0; }
          h2 { border-bottom: 1px solid #d9e2dc; font-size: 17px; margin: 24px 0 10px; padding-bottom: 6px; }
          .subtitle { color: #60716a; margin-top: 4px; }
          .meta { color: #60716a; font-size: 12px; margin-top: 8px; }
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
          .drawing { background: #f4f7f5; border: 1px solid #d9e2dc; border-radius: 8px; margin-top: 18px; padding: 18px; }
          .frame { border: 6px solid #35423e; height: 190px; margin: 0 auto; max-width: 280px; position: relative; }
          .frame-title { font-size: 13px; font-weight: 700; left: 12px; position: absolute; top: 12px; }
          .frame-size { bottom: 12px; color: #60716a; font-size: 12px; left: 12px; position: absolute; }
          .frame-grid { bottom: 46px; display: flex; flex-wrap: wrap; gap: 8px; left: 12px; position: absolute; right: 12px; top: 46px; }
          .frame-grid span { align-items: center; background: #d9e9f7; border: 2px solid #8ba69e; display: flex; flex: 1 0 28%; font-weight: 700; justify-content: center; min-height: 42px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="subtitle">${escapeHtml(subtitle)}</div>
        <div class="meta">Tarih: ${new Date().toLocaleDateString('tr-TR')}</div>
        ${body}
      </body>
    </html>
  `;
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
