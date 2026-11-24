/** Persisted geometry contracts. No renderer, widget catalog or UI dependencies. */
export interface GridFrame {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Grid {
  columns: number;
  rowHeight: number;
  gap: number;
  frame?: GridFrame;
  responsive?: { tabletColumns: number; mobileColumns: number };
}

export interface Position {
  col: number;
  row: number;
  width: number;
  height: number;
  free?: true;
}

export type DocumentKind = 'page' | 'presentation';
export interface LayoutWidget {
  type: string;
  title?: string;
  position: Position;
}
export interface LayoutSection {
  grid: Grid;
  widgets: LayoutWidget[];
}

/** A renderer supplies its own widget constraints; geometry never imports a registry. */
export interface WidgetMinimum {
  minWidth: number;
  minHeight: number;
  title: string;
}
export type WidgetConstraints = (type: string) => WidgetMinimum;
