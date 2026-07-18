import { DesignNode } from '../entities/DesignNode';
import { PanelNode } from '../entities/PanelNode';

export function findNodeById(rootNode: DesignNode, nodeId: string): DesignNode | null {
  const visited = new Set<string>();

  function visit(node: DesignNode): DesignNode | null {
    if (visited.has(node.id)) {
      return null;
    }

    visited.add(node.id);

    if (node.id === nodeId) {
      return node;
    }

    if (node.type === 'frame') {
      return visit(node.child);
    }

    if (node.type === 'split') {
      return visit(node.first) ?? visit(node.second);
    }

    return null;
  }

  return visit(rootNode);
}

export function collectNodeIds(rootNode: DesignNode): string[] {
  const visited = new Set<string>();
  const ids: string[] = [];

  function visit(node: DesignNode): void {
    if (visited.has(node.id)) {
      return;
    }

    visited.add(node.id);
    ids.push(node.id);

    if (node.type === 'frame') {
      visit(node.child);
    }

    if (node.type === 'split') {
      visit(node.first);
      visit(node.second);
    }
  }

  visit(rootNode);
  return ids;
}

export function countPanels(rootNode: DesignNode): number {
  const panels = new Set<string>();
  const visited = new Set<string>();

  function visit(node: DesignNode): void {
    if (visited.has(node.id)) {
      return;
    }

    visited.add(node.id);

    if (node.type === 'panel') {
      panels.add(node.id);
      return;
    }

    if (node.type === 'frame') {
      visit(node.child);
      return;
    }

    visit(node.first);
    visit(node.second);
  }

  visit(rootNode);
  return panels.size;
}

export function collectPanels(rootNode: DesignNode): PanelNode[] {
  const panels: PanelNode[] = [];
  const visited = new Set<string>();

  function visit(node: DesignNode): void {
    if (visited.has(node.id)) {
      return;
    }

    visited.add(node.id);

    if (node.type === 'panel') {
      panels.push(node);
      return;
    }

    if (node.type === 'frame') {
      visit(node.child);
      return;
    }

    visit(node.first);
    visit(node.second);
  }

  visit(rootNode);
  return panels;
}
