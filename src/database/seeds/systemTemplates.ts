import { DesignNode } from '../../domain/designs/entities/DesignNode';
import { FrameShape } from '../../domain/designs/entities/FrameNode';
import { OpeningType } from '../../domain/designs/enums/OpeningType';
import { DesignTemplate } from '../../domain/templates/entities/DesignTemplate';
import { TemplateCategory } from '../../domain/templates/enums/TemplateCategory';

const seedDate = '2026-01-01T00:00:00.000Z';

function panel(id: string, openingType: OpeningType): DesignNode {
  return { id, type: 'panel', openingType, glass: null, accessories: [], notes: null };
}

function split(
  id: string,
  direction: 'horizontal' | 'vertical',
  ratio: number,
  first: DesignNode,
  second: DesignNode,
): DesignNode {
  return { id, type: 'split', direction, ratio, first, second };
}

function frame(id: string, child: DesignNode, shape: FrameShape = 'rect'): DesignNode {
  return { id, type: 'frame', shape, child };
}

function verticalPanels(prefix: string, openings: OpeningType[]): DesignNode {
  if (openings.length === 1) {
    return panel(`${prefix}-panel-1`, openings[0] ?? 'fixed');
  }

  if (openings.length === 2) {
    return split(
      `${prefix}-split-1`,
      'vertical',
      0.5,
      panel(`${prefix}-panel-1`, openings[0] ?? 'fixed'),
      panel(`${prefix}-panel-2`, openings[1] ?? 'fixed'),
    );
  }

  if (openings.length === 3) {
    return split(
      `${prefix}-split-1`,
      'vertical',
      0.333,
      panel(`${prefix}-panel-1`, openings[0] ?? 'fixed'),
      split(
        `${prefix}-split-2`,
        'vertical',
        0.5,
        panel(`${prefix}-panel-2`, openings[1] ?? 'fixed'),
        panel(`${prefix}-panel-3`, openings[2] ?? 'fixed'),
      ),
    );
  }

  return split(
    `${prefix}-split-1`,
    'vertical',
    0.5,
    split(
      `${prefix}-split-2`,
      'vertical',
      0.5,
      panel(`${prefix}-panel-1`, openings[0] ?? 'fixed'),
      panel(`${prefix}-panel-2`, openings[1] ?? 'fixed'),
    ),
    split(
      `${prefix}-split-3`,
      'vertical',
      0.5,
      panel(`${prefix}-panel-3`, openings[2] ?? 'fixed'),
      panel(`${prefix}-panel-4`, openings[3] ?? 'fixed'),
    ),
  );
}

function template(input: {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  width: number;
  height: number;
  sortOrder: number;
  child: DesignNode;
  shape?: FrameShape;
}): DesignTemplate {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    category: input.category,
    source: 'system',
    rootNode: frame(`${input.id}-frame`, input.child, input.shape),
    defaultWidth: input.width,
    defaultHeight: input.height,
    previewAspectRatio: input.width / input.height,
    isFavorite: false,
    sortOrder: input.sortOrder,
    isActive: true,
    createdAt: seedDate,
    updatedAt: seedDate,
  };
}

export const systemTemplates: DesignTemplate[] = [
  template({
    id: 'tpl-classic-fixed-small',
    name: 'Klasik Tek Sabit',
    description: 'Kucuk alanlar icin tek parca sabit cam.',
    category: 'window',
    width: 700,
    height: 700,
    sortOrder: 1,
    child: panel('tpl-classic-fixed-small-panel-1', 'fixed'),
  }),
  template({
    id: 'tpl-classic-fixed-double',
    name: 'Klasik Cift Sabit',
    description: 'Iki esit bolmeli sabit pencere.',
    category: 'window',
    width: 1200,
    height: 1000,
    sortOrder: 2,
    child: verticalPanels('tpl-classic-fixed-double', ['fixed', 'fixed']),
  }),
  template({
    id: 'tpl-classic-fixed-triple',
    name: 'Klasik Uclu Sabit',
    description: 'Uc esit bolmeli genis sabit pencere.',
    category: 'window',
    width: 1800,
    height: 1000,
    sortOrder: 3,
    child: verticalPanels('tpl-classic-fixed-triple', ['fixed', 'fixed', 'fixed']),
  }),
  template({
    id: 'tpl-classic-top-tilt-bottom-fixed',
    name: 'Ust Vasistas Alt Sabit',
    description: 'Ustte vasistas, altta buyuk sabit cam.',
    category: 'tilt',
    width: 900,
    height: 1400,
    sortOrder: 4,
    child: split(
      'tpl-classic-top-tilt-bottom-fixed-split-1',
      'horizontal',
      0.28,
      panel('tpl-classic-top-tilt-bottom-fixed-panel-1', 'tilt-top'),
      panel('tpl-classic-top-tilt-bottom-fixed-panel-2', 'fixed'),
    ),
  }),
  template({
    id: 'tpl-classic-double-wing',
    name: 'Klasik Cift Kanat',
    description: 'Ortadan acilimli iki kanatli klasik pencere.',
    category: 'window',
    width: 1400,
    height: 1300,
    sortOrder: 5,
    child: verticalPanels('tpl-classic-double-wing', ['open-left', 'open-right']),
  }),
  template({
    id: 'tpl-classic-fixed-middle-open-fixed',
    name: 'Yan Sabit Orta Acilir',
    description: 'Yanlari sabit, ortasi acilir genis pencere.',
    category: 'window',
    width: 1900,
    height: 1300,
    sortOrder: 6,
    child: verticalPanels('tpl-classic-fixed-middle-open-fixed', [
      'fixed',
      'tilt-turn-right',
      'fixed',
    ]),
  }),
  template({
    id: 'tpl-classic-top-fixed-bottom-double',
    name: 'Ust Sabit Alt Cift Kanat',
    description: 'Ustte sabit cam, altta iki acilir kanat.',
    category: 'window',
    width: 1500,
    height: 1600,
    sortOrder: 7,
    child: split(
      'tpl-classic-top-fixed-bottom-double-split-1',
      'horizontal',
      0.3,
      panel('tpl-classic-top-fixed-bottom-double-panel-1', 'fixed'),
      verticalPanels('tpl-classic-top-fixed-bottom-double-bottom', ['open-left', 'open-right']),
    ),
  }),
  template({
    id: 'tpl-classic-balcony-door-with-window',
    name: 'Klasik Balkon Kapi Pencere',
    description: 'Bir balkon kapisi ve yaninda sabit pencere.',
    category: 'balcony',
    width: 1700,
    height: 2100,
    sortOrder: 8,
    child: split(
      'tpl-classic-balcony-door-with-window-split-1',
      'vertical',
      0.55,
      panel('tpl-classic-balcony-door-with-window-panel-1', 'door-right'),
      panel('tpl-classic-balcony-door-with-window-panel-2', 'fixed'),
    ),
  }),
  template({
    id: 'tpl-arched-three-panel-window',
    name: 'Kemerli Uclu Pencere',
    description: 'Ust kemerli, altta uc sabit panelden olusan klasik model.',
    category: 'window',
    width: 1800,
    height: 1800,
    sortOrder: 9,
    shape: { type: 'arch-top', archHeight: 520 },
    child: split(
      'tpl-arched-three-panel-window-split-1',
      'horizontal',
      0.38,
      verticalPanels('tpl-arched-three-panel-window-top', ['fixed', 'fixed', 'fixed']),
      verticalPanels('tpl-arched-three-panel-window-bottom', ['fixed', 'fixed', 'fixed']),
    ),
  }),
  template({
    id: 'tpl-arched-double-sash-with-top',
    name: 'Kemerli Cift Kanat',
    description: 'Fotograftaki gibi ustu kemerli, ortadan kayitli ve altta iki kanatli model.',
    category: 'window',
    width: 1600,
    height: 1900,
    sortOrder: 10,
    shape: { type: 'arch-top', archHeight: 620 },
    child: split(
      'tpl-arched-double-sash-with-top-split-1',
      'horizontal',
      0.42,
      verticalPanels('tpl-arched-double-sash-with-top-top', ['fixed', 'fixed']),
      verticalPanels('tpl-arched-double-sash-with-top-bottom', ['open-left', 'open-right']),
    ),
  }),
  template({
    id: 'tpl-arched-classic-four-light',
    name: 'Kemerli Dort Bolmeli',
    description: 'Ustte kemer bolumu, altta genis iki kanat bulunan klasik kavisli pencere.',
    category: 'window',
    width: 1800,
    height: 2000,
    sortOrder: 11,
    shape: { type: 'arch-top', archHeight: 700 },
    child: split(
      'tpl-arched-classic-four-light-split-1',
      'horizontal',
      0.45,
      verticalPanels('tpl-arched-classic-four-light-top', ['fixed', 'fixed']),
      verticalPanels('tpl-arched-classic-four-light-bottom', ['tilt-turn-left', 'tilt-turn-right']),
    ),
  }),
  template({
    id: 'tpl-fixed-single-window',
    name: 'Tek Sabit Pencere',
    description: 'Tek panel sabit pencere modeli.',
    category: 'window',
    width: 1000,
    height: 1000,
    sortOrder: 102,
    child: panel('tpl-fixed-single-window-panel-1', 'fixed'),
  }),
  template({
    id: 'tpl-open-right-single',
    name: 'Tek Kanat Sağa Açılır',
    description: 'Sağa açılır tek kanat pencere.',
    category: 'window',
    width: 900,
    height: 1200,
    sortOrder: 103,
    child: panel('tpl-open-right-single-panel-1', 'open-right'),
  }),
  template({
    id: 'tpl-open-left-single',
    name: 'Tek Kanat Sola Açılır',
    description: 'Sola açılır tek kanat pencere.',
    category: 'window',
    width: 900,
    height: 1200,
    sortOrder: 104,
    child: panel('tpl-open-left-single-panel-1', 'open-left'),
  }),
  template({
    id: 'tpl-tilt-turn-right-single',
    name: 'Tek Kanat Sağ Çift Açılım',
    description: 'Sağ menteşeli çift açılım pencere.',
    category: 'tilt',
    width: 900,
    height: 1200,
    sortOrder: 105,
    child: panel('tpl-tilt-turn-right-single-panel-1', 'tilt-turn-right'),
  }),
  template({
    id: 'tpl-tilt-turn-left-single',
    name: 'Tek Kanat Sol Çift Açılım',
    description: 'Sol menteşeli çift açılım pencere.',
    category: 'tilt',
    width: 900,
    height: 1200,
    sortOrder: 106,
    child: panel('tpl-tilt-turn-left-single-panel-1', 'tilt-turn-left'),
  }),
  template({
    id: 'tpl-double-sash-window',
    name: 'Çift Kanat Pencere',
    description: 'Sol ve sağ açılır iki kanatlı pencere.',
    category: 'window',
    width: 1400,
    height: 1400,
    sortOrder: 107,
    child: verticalPanels('tpl-double-sash-window', ['open-left', 'open-right']),
  }),
  template({
    id: 'tpl-fixed-left-open-right',
    name: 'Sol Sabit Sağ Açılır',
    description: 'Sol bölümü sabit, sağ bölümü açılır pencere.',
    category: 'window',
    width: 1400,
    height: 1300,
    sortOrder: 108,
    child: verticalPanels('tpl-fixed-left-open-right', ['fixed', 'open-right']),
  }),
  template({
    id: 'tpl-open-left-fixed-right',
    name: 'Sol Açılır Sağ Sabit',
    description: 'Sol bölümü açılır, sağ bölümü sabit pencere.',
    category: 'window',
    width: 1400,
    height: 1300,
    sortOrder: 109,
    child: verticalPanels('tpl-open-left-fixed-right', ['open-left', 'fixed']),
  }),
  template({
    id: 'tpl-three-panel-window',
    name: 'Üç Bölmeli Pencere',
    description: 'Ortası çift açılım, yanları sabit üç bölmeli pencere.',
    category: 'window',
    width: 1800,
    height: 1300,
    sortOrder: 110,
    child: verticalPanels('tpl-three-panel-window', ['fixed', 'tilt-turn-right', 'fixed']),
  }),
  template({
    id: 'tpl-four-panel-window',
    name: 'Dört Bölmeli Pencere',
    description: 'Dört dikey panelli geniş pencere.',
    category: 'window',
    width: 2200,
    height: 1300,
    sortOrder: 111,
    child: verticalPanels('tpl-four-panel-window', ['fixed', 'open-left', 'open-right', 'fixed']),
  }),
  template({
    id: 'tpl-top-tilt-window',
    name: 'Üstü Tek Vasistaslı Pencere',
    description: 'Üstte vasistas, altta sabit panel.',
    category: 'tilt',
    width: 1200,
    height: 1500,
    sortOrder: 112,
    child: split(
      'tpl-top-tilt-window-split-1',
      'horizontal',
      0.3,
      panel('tpl-top-tilt-window-panel-1', 'tilt-top'),
      panel('tpl-top-tilt-window-panel-2', 'fixed'),
    ),
  }),
  template({
    id: 'tpl-two-top-tilt-two-bottom',
    name: 'Üstte İki Vasistas Altta İki Panel',
    description: 'Üst sırada iki vasistas, altta iki açılır panel.',
    category: 'tilt',
    width: 1600,
    height: 1600,
    sortOrder: 113,
    child: split(
      'tpl-two-top-tilt-two-bottom-split-1',
      'horizontal',
      0.35,
      verticalPanels('tpl-two-top-tilt-two-bottom-top', ['tilt-top', 'tilt-top']),
      verticalPanels('tpl-two-top-tilt-two-bottom-bottom', ['open-left', 'open-right']),
    ),
  }),
  template({
    id: 'tpl-single-balcony-door',
    name: 'Tek Balkon Kapısı',
    description: 'Sağa açılır tek balkon kapısı.',
    category: 'balcony',
    width: 900,
    height: 2100,
    sortOrder: 114,
    child: panel('tpl-single-balcony-door-panel-1', 'door-right'),
  }),
  template({
    id: 'tpl-double-balcony-door',
    name: 'Çift Balkon Kapısı',
    description: 'İki kanatlı balkon kapısı.',
    category: 'balcony',
    width: 1500,
    height: 2100,
    sortOrder: 115,
    child: verticalPanels('tpl-double-balcony-door', ['door-left', 'door-right']),
  }),
  template({
    id: 'tpl-balcony-door-window',
    name: 'Balkon Kapısı ve Pencere',
    description: 'Sol geniş kapı, sağ sabit pencere.',
    category: 'balcony',
    width: 1700,
    height: 2100,
    sortOrder: 116,
    child: split(
      'tpl-balcony-door-window-split-1',
      'vertical',
      0.65,
      panel('tpl-balcony-door-window-panel-1', 'door-right'),
      panel('tpl-balcony-door-window-panel-2', 'fixed'),
    ),
  }),
  template({
    id: 'tpl-door-with-top-glass',
    name: 'Kapı Üstü Sabit Cam',
    description: 'Üstte sabit cam, altta kapı.',
    category: 'door',
    width: 1000,
    height: 2400,
    sortOrder: 117,
    child: split(
      'tpl-door-with-top-glass-split-1',
      'horizontal',
      0.25,
      panel('tpl-door-with-top-glass-panel-1', 'fixed'),
      panel('tpl-door-with-top-glass-panel-2', 'door-right'),
    ),
  }),
  template({
    id: 'tpl-door-with-side-glass',
    name: 'Kapı Yanı Sabit Cam',
    description: 'Sol kapı, sağ sabit yan cam.',
    category: 'door',
    width: 1500,
    height: 2200,
    sortOrder: 118,
    child: verticalPanels('tpl-door-with-side-glass', ['door-right', 'fixed']),
  }),
  template({
    id: 'tpl-double-sliding-window',
    name: 'Çift Sürme Pencere',
    description: 'İki panelli sürme pencere.',
    category: 'sliding',
    width: 1600,
    height: 1300,
    sortOrder: 119,
    child: verticalPanels('tpl-double-sliding-window', ['sliding-right', 'sliding-left']),
  }),
  template({
    id: 'tpl-three-panel-sliding',
    name: 'Üç Bölmeli Sürme Sistem',
    description: 'Örnek üç bölmeli sürme düzeni.',
    category: 'sliding',
    width: 2400,
    height: 1400,
    sortOrder: 120,
    child: verticalPanels('tpl-three-panel-sliding', ['sliding-right', 'fixed', 'sliding-left']),
  }),
  template({
    id: 'tpl-custom-empty-design',
    name: 'Özel Boş Tasarım',
    description: 'Editörde bölmeler eklemek için boş tek panelli başlangıç.',
    category: 'special',
    width: 1000,
    height: 1000,
    sortOrder: 121,
    child: panel('tpl-custom-empty-design-panel-1', 'fixed'),
  }),
];
