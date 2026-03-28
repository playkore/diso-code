/**
 * Ship presenter selection is intentionally tiny today: travel combat still
 * draws flat wireframes, but the renderer now routes ship creation through an
 * explicit presenter contract so future 3D model-backed presenters can slot in
 * without changing combat-state or renderer call sites.
 */
export interface ShipPresenter {
  id: 'flat-wireframe';
  geometryMode: 'line-shape';
}

export const FLAT_WIREFRAME_SHIP_PRESENTER: ShipPresenter = {
  id: 'flat-wireframe',
  geometryMode: 'line-shape'
};

export function selectShipPresenter(_requested: 'flat-wireframe' | 'wireframe-model' = 'flat-wireframe'): ShipPresenter {
  return FLAT_WIREFRAME_SHIP_PRESENTER;
}
