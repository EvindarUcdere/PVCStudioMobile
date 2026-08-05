import { describe, expect, it } from 'vitest';

import { designProjectSchema } from '../../designs/schemas/designProjectSchema';
import { validateDesignTree } from '../../designs/rules/validateDesignTree';
import { collectNodeIds, countPanels, collectPanels } from '../../designs/utils/findNodeById';
import { createDesignFromTemplate } from '../factories/createDesignFromTemplate';
import { templateCategories } from '../enums/TemplateCategory';
import { systemTemplates } from '../../../database/seeds/systemTemplates';

describe('system templates', () => {
  it('contains exactly 32 active system templates with unique ids', () => {
    expect(systemTemplates).toHaveLength(32);
    expect(new Set(systemTemplates.map((template) => template.id)).size).toBe(32);
    expect(
      systemTemplates.every((template) => template.source === 'system' && template.isActive),
    ).toBe(true);
  });

  it('contains valid names, categories, dimensions and sort orders', () => {
    const sortOrders = systemTemplates.map((template) => template.sortOrder);

    expect(systemTemplates.every((template) => template.name.trim().length > 0)).toBe(true);
    expect(
      systemTemplates.every((template) => templateCategories.includes(template.category)),
    ).toBe(true);
    expect(
      systemTemplates.every((template) => template.defaultWidth > 0 && template.defaultHeight > 0),
    ).toBe(true);
    expect(sortOrders).toEqual([...sortOrders].sort((left, right) => left - right));
  });

  it('has valid design trees with unique node ids', () => {
    for (const template of systemTemplates) {
      const validation = validateDesignTree(template.rootNode);
      const nodeIds = collectNodeIds(template.rootNode);

      expect(validation.errors).toEqual([]);
      expect(new Set(nodeIds).size).toBe(nodeIds.length);
    }
  });

  it('models special, three-panel, four-panel, tilt and sliding templates correctly', () => {
    const custom = systemTemplates.find((template) => template.id === 'tpl-custom-empty-design');
    const three = systemTemplates.find((template) => template.id === 'tpl-three-panel-window');
    const four = systemTemplates.find((template) => template.id === 'tpl-four-panel-window');
    const topTilt = systemTemplates.find((template) => template.id === 'tpl-top-tilt-window');
    const sliding = systemTemplates.filter((template) => template.category === 'sliding');

    expect(custom ? countPanels(custom.rootNode) : 0).toBe(1);
    expect(collectPanels(custom!.rootNode)[0]?.openingType).toBe('fixed');
    expect(three ? countPanels(three.rootNode) : 0).toBe(3);
    expect(four ? countPanels(four.rootNode) : 0).toBe(4);
    expect(collectPanels(topTilt!.rootNode).some((panel) => panel.openingType === 'tilt-top')).toBe(
      true,
    );
    expect(
      sliding.every((template) =>
        collectPanels(template.rootNode).some((panel) => panel.openingType.startsWith('sliding')),
      ),
    ).toBe(true);
  });

  it('contains an arched top template', () => {
    const arched = systemTemplates.find((template) => template.id === 'tpl-arched-three-panel-window');

    expect(arched?.rootNode.type).toBe('frame');
    if (arched?.rootNode.type === 'frame') {
      expect(arched.rootNode.shape).toEqual({ type: 'arch-top', archHeight: 520 });
    }
  });

  it('contains the 1400x1400 fixed-left open-right reference template', () => {
    const reference = systemTemplates.find(
      (template) => template.id === 'tpl-reference-1400-fixed-left-open-right',
    );

    expect(reference?.defaultWidth).toBe(1400);
    expect(reference?.defaultHeight).toBe(1400);
    expect(collectPanels(reference!.rootNode).map((panel) => panel.openingType)).toEqual([
      'fixed',
      'open-right',
    ]);
  });
});

describe('createDesignFromTemplate', () => {
  it('creates an independent design project with renewed ids', () => {
    const template = systemTemplates[5]!;
    const templateNodeIds = collectNodeIds(template.rootNode);
    const project = createDesignFromTemplate({
      template,
      name: 'Salon Penceresi',
      width: 1700,
      height: 1400,
      quantity: 2,
    });
    const projectNodeIds = collectNodeIds(project.rootNode);

    expect(project.id).not.toBe(template.id);
    expect(project.templateId).toBe(template.id);
    expect(project.width).toBe(1700);
    expect(project.height).toBe(1400);
    expect(project.quantity).toBe(2);
    expect(projectNodeIds.every((id) => !templateNodeIds.includes(id))).toBe(true);
    expect(() => designProjectSchema.parse(project)).not.toThrow();
    expect(collectNodeIds(template.rootNode)).toEqual(templateNodeIds);
  });

  it('keeps selected production profile system metadata on the created design', () => {
    const template = systemTemplates[0]!;
    const project = createDesignFromTemplate({
      template,
      name: 'Mutfak Penceresi',
      width: 1200,
      height: 1400,
      quantity: 1,
      profileSystem: {
        brandId: 'standard-70',
        seriesId: 'standard-70',
        profileWidth: 70,
        chamberCount: 5,
        wallClass: 'B',
        gasketCount: null,
        gasketColor: null,
        steelThickness: null,
        interiorColorId: 'white',
        exteriorColorId: 'white',
        productionProfileSystemId: 'profile-system-1',
        productionProfileSystemName: 'TEST-BRAND TEST-SERIES',
        productionProfileSystemVersion: '1.0.0',
        productionProfileSystemStatus: 'VERIFIED',
      },
    });

    expect(project.profileSystem?.productionProfileSystemId).toBe('profile-system-1');
    expect(project.profileSystem?.productionProfileSystemVersion).toBe('1.0.0');
    expect(() => designProjectSchema.parse(project)).not.toThrow();
  });
});
