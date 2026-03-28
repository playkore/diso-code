import { CGA_GREEN, CGA_RED, CGA_YELLOW } from '../renderers/constants';
import type { BackgroundObjectDefinition } from './types';

/**
 * Source-of-truth preview catalog for travel background objects.
 *
 * The first batch intentionally favors a small but varied set of silhouettes
 * so the debug playground can validate the multi-contour format before scene
 * generation logic starts assembling these shapes into system backdrops.
 */
export const BACKGROUND_OBJECT_DEFINITIONS: BackgroundObjectDefinition[] = [
  {
    id: 'asteroid-jagged',
    label: 'Jagged Asteroid',
    kind: 'asteroid',
    color: CGA_YELLOW,
    defaultScale: 2.2,
    defaultAngle: Math.PI / 10,
    shape: [
      {
        points: [
          [-22, -8],
          [-10, -20],
          [8, -18],
          [20, -6],
          [18, 10],
          [4, 22],
          [-15, 17],
          [-24, 4]
        ],
        closed: true
      },
      {
        points: [
          [-6, -6],
          [2, -10],
          [8, -2],
          [1, 6],
          [-8, 2]
        ],
        closed: true
      }
    ]
  },
  {
    id: 'debris-cluster',
    label: 'Debris Cluster',
    kind: 'debrisCluster',
    color: CGA_RED,
    defaultScale: 2,
    defaultAngle: 0,
    shape: [
      {
        points: [
          [-28, -8],
          [-20, -16],
          [-15, -6],
          [-21, 2],
          [-30, -2]
        ],
        closed: true
      },
      {
        points: [
          [6, -18],
          [14, -12],
          [10, -4],
          [2, -8]
        ],
        closed: true
      },
      {
        points: [
          [14, 6],
          [24, 0],
          [28, 8],
          [20, 15],
          [10, 12]
        ],
        closed: true
      },
      {
        points: [
          [-6, 12],
          [-1, 20],
          [7, 16],
          [3, 8]
        ],
        closed: true
      }
    ]
  },
  {
    id: 'wrecked-freighter',
    label: 'Wrecked Freighter',
    kind: 'wreck',
    color: CGA_RED,
    defaultScale: 2.4,
    defaultAngle: -Math.PI / 14,
    shape: [
      {
        points: [
          [-34, 0],
          [-10, -16],
          [20, -10],
          [34, 0],
          [14, 15],
          [-14, 12]
        ],
        closed: true
      },
      {
        points: [
          [-4, -9],
          [6, 0],
          [-3, 8]
        ]
      },
      {
        points: [
          [12, -10],
          [6, -18],
          [0, -12]
        ]
      },
      {
        points: [
          [8, 8],
          [20, 16],
          [28, 12]
        ]
      }
    ]
  },
  {
    id: 'ruined-station-ring',
    label: 'Ruined Station Ring',
    kind: 'ruinedStation',
    color: CGA_GREEN,
    defaultScale: 1.85,
    defaultAngle: Math.PI / 8,
    shape: [
      {
        points: [
          [40, 0],
          [18, -34],
          [-18, -34],
          [-40, 0],
          [-18, 34],
          [12, 34]
        ]
      },
      {
        points: [
          [24, 20],
          [40, 0],
          [18, -34]
        ]
      },
      {
        points: [
          [4, -10],
          [16, -2],
          [10, 10]
        ]
      },
      {
        points: [
          [-12, 16],
          [-4, 28],
          [8, 26]
        ]
      }
    ]
  }
];

export function getBackgroundObjectDefinition(id: string) {
  return BACKGROUND_OBJECT_DEFINITIONS.find((definition) => definition.id === id);
}
