import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIntroScene } from '../src/ui/introScene.mjs';
import { sampleField } from '../src/engine/terrain.mjs';

test('intro chase: every ship stays a hull clear of land for the whole scene', () => {
  const sc = buildIntroScene(1);
  // Sloop, cutter and brig lanes (lag, lateral) over the 8.6s scene plus slack.
  for (const [lag, lat, ph] of [[0, 0, 0], [0.9, -24, 1.3], [1.45, 28, 2.2]]) {
    for (let t = 0; t <= 9.5; t += 0.1) {
      const tt = Math.max(0, t - lag);
      const p = sc.along(tt * 54, lat + sc.weave(tt, 22, 0.55, ph));
      const d = sampleField(sc.terrain.sdf, p.x, p.y);
      assert.ok(d < -12, `lane ${lat} at ${t.toFixed(1)}s is ${d.toFixed(1)}px from the shore`);
    }
  }
});
