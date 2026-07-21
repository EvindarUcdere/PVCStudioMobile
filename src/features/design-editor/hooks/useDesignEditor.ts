import { useCallback, useEffect, useState } from 'react';

import { createDesignRepository } from '../../../database/repositories/createRepositories';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { OpeningType } from '../../../domain/designs/enums/OpeningType';
import { SplitDirection } from '../../../domain/designs/enums/SplitDirection';
import { GlassPriceOption, ProfileSystemPriceOption } from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { validateDesignTree } from '../../../domain/designs/rules/validateDesignTree';
import { designProjectSchema } from '../../../domain/designs/schemas/designProjectSchema';
import { collectPanels } from '../../../domain/designs/utils/findNodeById';
import {
  AddPanelSide,
  MergePanelSide,
  addPanelToDesignEdge,
  adjustArchHeight,
  mergePanelWithAdjacent,
  removePanel,
  splitPanel,
  updatePanelOpening,
  updateDefaultGlassSelection,
  updateProfileColor,
  updateProfileSystemSelection,
} from '../../../domain/designs/utils/editDesignTree';
import { logger } from '../../../services/logger';
import { EditorSelection } from '../types/editorTypes';
import { clearSelection, selectPanel } from '../utils/editorSelection';

type DesignEditorState = {
  design: DesignProject | null;
  history: DesignProject[];
  future: DesignProject[];
  selection: EditorSelection;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  saveMessage: string | null;
};

const invalidTreeMessage = 'Bu islem tasarim agacini bozabilecegi icin uygulanmadi.';

function buildValidEditorState(
  current: DesignEditorState,
  nextDesign: DesignProject,
  selection: EditorSelection = current.selection,
): DesignEditorState {
  const validation = validateDesignTree(nextDesign.rootNode);

  if (!validation.isValid) {
    logger.info('Invalid design tree edit blocked', validation.errors);
    return {
      ...current,
      error: invalidTreeMessage,
      saveMessage: null,
    };
  }

  return {
    ...current,
    design: nextDesign,
    history: [...current.history, current.design!],
    future: [],
    selection,
    isDirty: true,
    error: null,
    saveMessage: null,
  };
}

export function useDesignEditor(designId: string | undefined) {
  const [state, setState] = useState<DesignEditorState>({
    design: null,
    history: [],
    future: [],
    selection: null,
    isLoading: true,
    isSaving: false,
    isDirty: false,
    error: null,
    saveMessage: null,
  });

  const loadDesign = useCallback(async () => {
    if (!designId?.trim()) {
      setState({
        design: null,
        history: [],
        future: [],
        selection: null,
        isLoading: false,
        isSaving: false,
        isDirty: false,
        error: 'Tasarim bulunamadi.',
        saveMessage: null,
      });
      return;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
      selection: null,
      saveMessage: null,
    }));

    try {
      const repository = await createDesignRepository();
      const design = await repository.getById(designId);

      if (!design) {
        setState({
          design: null,
          history: [],
          future: [],
          selection: null,
          isLoading: false,
          isSaving: false,
          isDirty: false,
          error: 'Tasarim bulunamadi. Bu kayit silinmis veya artik mevcut olmayabilir.',
          saveMessage: null,
        });
        return;
      }

      const parsed = designProjectSchema.safeParse(design);
      if (!parsed.success) {
        setState({
          design: null,
          history: [],
          future: [],
          selection: null,
          isLoading: false,
          isSaving: false,
          isDirty: false,
          error: 'Bu tasarimin verileri okunamadi.',
          saveMessage: null,
        });
        return;
      }

      setState({
        design,
        history: [],
        future: [],
        selection: null,
        isLoading: false,
        isSaving: false,
        isDirty: false,
        error: null,
        saveMessage: null,
      });
    } catch (error) {
      logger.error('Design editor load failed', error);
      setState({
        design: null,
        history: [],
        future: [],
        selection: null,
        isLoading: false,
        isSaving: false,
        isDirty: false,
        error: 'Tasarim yuklenirken bir sorun olustu. Lutfen tekrar deneyin.',
        saveMessage: null,
      });
    }
  }, [designId]);

  useEffect(() => {
    void loadDesign();

    return () => {
      setState({
        design: null,
        history: [],
        future: [],
        selection: null,
        isLoading: false,
        isSaving: false,
        isDirty: false,
        error: null,
        saveMessage: null,
      });
    };
  }, [loadDesign]);

  const selectPanelById = useCallback((panelId: string) => {
    setState((current) => ({
      ...current,
      selection: current.design ? selectPanel(current.design.rootNode, panelId) : null,
    }));
  }, []);

  const clearEditorSelection = useCallback(() => {
    setState((current) => ({ ...current, selection: clearSelection() }));
  }, []);

  const splitSelectedPanel = useCallback((direction: SplitDirection) => {
    setState((current) => {
      if (!current.design || !current.selection) {
        return current;
      }

      return buildValidEditorState(current, {
        ...current.design,
        rootNode: splitPanel(current.design.rootNode, current.selection.nodeId, direction),
      });
    });
  }, []);

  const removeSelectedPanel = useCallback(() => {
    setState((current) => {
      if (!current.design || !current.selection) {
        return current;
      }

      const nextRootNode = removePanel(current.design.rootNode, current.selection.nodeId);
      const nextPanel = collectPanels(nextRootNode)[0] ?? null;

      return buildValidEditorState(
        current,
        { ...current.design, rootNode: nextRootNode },
        nextPanel ? { nodeId: nextPanel.id, nodeType: 'panel' } : null,
      );
    });
  }, []);

  const updateSelectedOpening = useCallback((openingType: OpeningType) => {
    setState((current) => {
      if (!current.design || !current.selection) {
        return current;
      }

      return {
        ...current,
        design: {
          ...current.design,
          rootNode: updatePanelOpening(current.design.rootNode, current.selection.nodeId, openingType),
        },
        history: [...current.history, current.design],
        future: [],
        isDirty: true,
        error: null,
        saveMessage: null,
      };
    });
  }, []);

  const addPanelAtEdge = useCallback((side: AddPanelSide, sizeMm?: number) => {
    setState((current) => {
      if (!current.design || !current.selection) {
        return current;
      }

      return buildValidEditorState(
        current,
        addPanelToDesignEdge(current.design, current.selection.nodeId, side, sizeMm),
      );
    });
  }, []);

  const mergeSelectedPanel = useCallback((side: MergePanelSide) => {
    setState((current) => {
      if (!current.design || !current.selection) {
        return current;
      }

      const nextRootNode = mergePanelWithAdjacent(
        current.design.rootNode,
        current.selection.nodeId,
        side,
      );

      if (nextRootNode === current.design.rootNode) {
        return {
          ...current,
          error: 'Bu yonde birlestirilecek komsu panel bulunamadi.',
          saveMessage: null,
        };
      }

      return buildValidEditorState(current, {
        ...current.design,
        rootNode: nextRootNode,
      });
    });
  }, []);

  const adjustSelectedArchHeight = useCallback((delta: number) => {
    setState((current) => {
      if (!current.design) {
        return current;
      }

      return {
        ...current,
        design: adjustArchHeight(current.design, delta),
        history: [...current.history, current.design],
        future: [],
        isDirty: true,
        error: null,
        saveMessage: null,
      };
    });
  }, []);

  const updateSelectedProfileColor = useCallback((colorId: string) => {
    setState((current) => {
      if (!current.design) {
        return current;
      }

      return {
        ...current,
        design: updateProfileColor(current.design, colorId),
        history: [...current.history, current.design],
        future: [],
        isDirty: true,
        error: null,
        saveMessage: null,
      };
    });
  }, []);

  const updateProfileSystem = useCallback((option: ProfileSystemPriceOption) => {
    setState((current) => {
      if (!current.design) {
        return current;
      }

      return {
        ...current,
        design: updateProfileSystemSelection(current.design, option),
        history: [...current.history, current.design],
        future: [],
        isDirty: true,
        error: null,
        saveMessage: null,
      };
    });
  }, []);

  const updateDefaultGlass = useCallback((option: GlassPriceOption) => {
    setState((current) => {
      if (!current.design) {
        return current;
      }

      return {
        ...current,
        design: updateDefaultGlassSelection(current.design, option),
        history: [...current.history, current.design],
        future: [],
        isDirty: true,
        error: null,
        saveMessage: null,
      };
    });
  }, []);

  const saveDesign = useCallback(async () => {
    if (!state.design || state.isSaving) {
      return;
    }

    setState((current) => ({ ...current, isSaving: true, error: null, saveMessage: null }));
    try {
      const repository = await createDesignRepository();
      const savedDesign = await repository.update(state.design);
      setState((current) => ({
        ...current,
        design: savedDesign,
        history: [],
        future: [],
        isSaving: false,
        isDirty: false,
        saveMessage: 'Degisiklikler kaydedildi.',
      }));
    } catch (error) {
      logger.error('Design editor save failed', error);
      setState((current) => ({
        ...current,
        isSaving: false,
        error: 'Degisiklikler kaydedilemedi. Lutfen tekrar deneyin.',
      }));
    }
  }, [state.design, state.isSaving]);

  const undoLastChange = useCallback(() => {
    setState((current) => {
      const previous = current.history[current.history.length - 1];

      if (!previous) {
        return current;
      }

      return {
        ...current,
        design: previous,
        history: current.history.slice(0, -1),
        future: current.design ? [...current.future, current.design] : current.future,
        selection: null,
        isDirty: current.history.length > 1,
        error: null,
        saveMessage: null,
      };
    });
  }, []);

  const redoLastChange = useCallback(() => {
    setState((current) => {
      const next = current.future[current.future.length - 1];

      if (!next || !current.design) {
        return current;
      }

      return {
        ...current,
        design: next,
        history: [...current.history, current.design],
        future: current.future.slice(0, -1),
        selection: null,
        isDirty: true,
        error: null,
        saveMessage: null,
      };
    });
  }, []);

  return {
    ...state,
    selectedNodeId: state.selection?.nodeId ?? null,
    canUndo: state.history.length > 0,
    canRedo: state.future.length > 0,
    reload: loadDesign,
    selectPanelById,
    clearEditorSelection,
    splitSelectedPanel,
    removeSelectedPanel,
    updateSelectedOpening,
    addPanelAtEdge,
    mergeSelectedPanel,
    adjustSelectedArchHeight,
    updateSelectedProfileColor,
    updateProfileSystem,
    updateDefaultGlass,
    saveDesign,
    undoLastChange,
    redoLastChange,
  };
}
