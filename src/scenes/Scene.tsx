import React from 'react';

import { SceneKind } from '../domain/types';
import { SceneProps } from './common';
import { ConstellationScene } from './ConstellationScene';
import { FillScene } from './FillScene';
import { OrbitScene } from './OrbitScene';
import { PlantScene } from './PlantScene';

export type { SceneProps } from './common';

/** One of the four focus scenes, each drawing real progress toward the target. */
export function Scene({ kind, ...props }: SceneProps & { kind: SceneKind }) {
  switch (kind) {
    case 'plant':
      return <PlantScene {...props} />;
    case 'orbit':
      return <OrbitScene {...props} />;
    case 'fill':
      return <FillScene {...props} />;
    case 'constellation':
      return <ConstellationScene {...props} />;
  }
}
