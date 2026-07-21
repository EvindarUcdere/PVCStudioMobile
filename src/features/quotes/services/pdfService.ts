import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { getDesignProfileColor } from '../../../domain/designs/colors/profileColorOptions';
import { calculateDesignLayout } from '../../../domain/designs/layout/calculateDesignLayout';
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
        ${buildDesignSvg(design)}
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
          .drawing { background: #f4f7f5; border: 1px solid #d9e2dc; border-radius: 8px; margin-top: 18px; padding: 18px; text-align: center; }
          .design-svg { max-width: 100%; }
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

function buildDesignSvg(design: DesignProject): string {
  const canvasWidth = 420;
  const canvasHeight = 300;
  const layout = calculateDesignLayout({
    rootNode: design.rootNode,
    designWidth: design.width,
    designHeight: design.height,
    canvasWidth,
    canvasHeight,
    padding: 42,
  });
  const profileColor = getDesignProfileColor(design.profileSystem).hexValue;
  const frame = layout.frameBounds;
  const frameStroke = 10;
  const glassInset = 12;
  const splitStroke = 8;

  const panels = layout.panelBounds
    .map((panel, index) => {
      const x = round(panel.x + glassInset);
      const y = round(panel.y + glassInset);
      const width = round(Math.max(8, panel.width - glassInset * 2));
      const height = round(Math.max(8, panel.height - glassInset * 2));
      const opening = buildOpeningSymbol(panel.openingType, x, y, width, height);

      return `
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#d7e8f8" stroke="#879a93" stroke-width="2" />
        ${opening}
        <text x="${round(x + width / 2)}" y="${round(y + height / 2 + 4)}" text-anchor="middle" font-size="13" font-weight="700" fill="#16211d">${index + 1}</text>
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
      <rect x="${round(frame.x)}" y="${round(frame.y)}" width="${round(frame.width)}" height="${round(frame.height)}" fill="#f8fbf9" stroke="${profileColor}" stroke-width="${frameStroke}" />
      ${panels}
      ${splits}
      <rect x="${round(frame.x)}" y="${round(frame.y)}" width="${round(frame.width)}" height="${round(frame.height)}" fill="none" stroke="#24302c" stroke-width="2" />
      <line x1="${round(frame.x)}" y1="${round(frame.y + frame.height + 22)}" x2="${round(frame.x + frame.width)}" y2="${round(frame.y + frame.height + 22)}" stroke="#16211d" stroke-width="1" />
      <text x="${round(frame.x + frame.width / 2)}" y="${round(frame.y + frame.height + 38)}" text-anchor="middle" font-size="12" fill="#16211d">${design.width} mm</text>
      <line x1="${round(frame.x - 24)}" y1="${round(frame.y)}" x2="${round(frame.x - 24)}" y2="${round(frame.y + frame.height)}" stroke="#16211d" stroke-width="1" />
      <text x="${round(frame.x - 34)}" y="${round(frame.y + frame.height / 2)}" transform="rotate(-90 ${round(frame.x - 34)} ${round(frame.y + frame.height / 2)})" text-anchor="middle" font-size="12" fill="#16211d">${design.height} mm</text>
    </svg>
  `;
}

function buildOpeningSymbol(openingType: string, x: number, y: number, width: number, height: number): string {
  const stroke = '#1f7a69';
  const cx = round(x + width / 2);
  const cy = round(y + height / 2);

  if (openingType === 'fixed') {
    return '';
  }

  if (openingType === 'open-left' || openingType === 'tilt-turn-left') {
    return `<polyline points="${x},${y} ${round(x + width)},${cy} ${x},${round(y + height)}" fill="none" stroke="${stroke}" stroke-width="2" />`;
  }

  if (openingType === 'open-right' || openingType === 'tilt-turn-right') {
    return `<polyline points="${round(x + width)},${y} ${x},${cy} ${round(x + width)},${round(y + height)}" fill="none" stroke="${stroke}" stroke-width="2" />`;
  }

  if (openingType === 'tilt-top') {
    return `<polyline points="${x},${y} ${cx},${round(y + height)} ${round(x + width)},${y}" fill="none" stroke="${stroke}" stroke-width="2" />`;
  }

  if (openingType === 'tilt-bottom') {
    return `<polyline points="${x},${round(y + height)} ${cx},${y} ${round(x + width)},${round(y + height)}" fill="none" stroke="${stroke}" stroke-width="2" />`;
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
