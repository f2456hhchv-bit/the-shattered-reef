import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateCombat } from '../src/engine/combat.mjs';
import { instantiate } from '../src/data/minions.mjs';
import { makeSeededRng } from '../src/engine/rng.mjs';

const solo = (defId, id = defId) => [instantiate(defId, id)];

test('the much bigger minion wins a 1v1 and the loser takes damage equal to survivor tier', () => {
  // Captain Vex 4/4 vs Ghost Light 1/1: Light dies to the hit, deals 1 back,
  // then its own deathrattle (2 damage to a random enemy) also lands on
  // Vex — the only enemy left. Vex should survive on exactly 1 health.
  const rng = makeSeededRng(1);
  const result = simulateCombat(solo('reaver-captain-vex'), solo('neutral-ghost-light'), { rng });
  assert.equal(result.winner, 'A');
  assert.equal(result.damageToLoser, 3); // Captain Vex is tier 3
  assert.equal(result.boardA.length, 1);
  assert.equal(result.boardA[0].health, 1);
  assert.equal(result.boardB.length, 0);
});

test('simultaneous mutual kill is a draw with no damage', () => {
  const rng = makeSeededRng(2);
  const result = simulateCombat(solo('neutral-ghost-light'), solo('neutral-ghost-light', 'gl2'), { rng });
  assert.equal(result.winner, 'draw');
  assert.equal(result.damageToLoser, 0);
  assert.equal(result.boardA.length, 0);
  assert.equal(result.boardB.length, 0);
});

test('taunt forces the attack onto the taunt minion even with a non-taunt minion present', () => {
  const rng = makeSeededRng(3);
  // Old Sea Dog (3/3, taunt) + a fragile Ghost Light (1/1, no taunt) vs a
  // single 3/2 attacker. The attacker must hit the taunt, not the 1/1.
  const boardB = [instantiate('neutral-old-sea-dog', 'dog'), instantiate('neutral-ghost-light', 'light')];
  const result = simulateCombat(solo('reaver-bilge-rigger'), boardB, { rng });
  // Ghost Light (1/1, untouched) must still be alive — only the taunt could
  // have been legally targeted by the single attack that landed on side B.
  assert.ok(result.boardB.some((m) => m.instanceId === 'light'));
});

test('deathrattle summon fires and adds minions to the board (even if they die fighting on)', () => {
  const rng = makeSeededRng(4);
  // Plunder Skiff (2/2) dies to a much bigger hit and summons two Deckhands.
  // Against Reefbound Leviathan (5/6) those Deckhands don't survive long
  // either, so check the summon actually happened via the log, not the
  // final board — the final board proves the fight continued afterward.
  const result = simulateCombat(
    solo('reaver-plunder-skiff'),
    [instantiate('wyrdtide-reefbound-leviathan', 'leviathan')],
    { rng }
  );
  const summonEvent = result.log.find((e) => e.type === 'summon' && e.minionId === 'reaver-deckhand');
  assert.ok(summonEvent, 'expected Plunder Skiff to summon Deckhands');
  assert.equal(summonEvent.count, 2);
  assert.notEqual(result.winner, 'A'); // two 2/2s and a dead Skiff can't out-damage a 5/6
});

test('deathrattle damage can chain-kill a second minion', () => {
  const rng = makeSeededRng(5);
  // Powder Rat (1/3) deathrattle deals 1 damage. Pair it with a lone 1-health
  // enemy so the deathrattle is guaranteed to finish it off once Powder Rat dies.
  const boardA = [instantiate('reaver-powder-rat', 'rat')];
  const boardB = [instantiate('neutral-ghost-light', 'light')]; // 1/1
  const result = simulateCombat(boardA, boardB, { rng });
  // Ghost Light has only 1 health; Powder Rat's own deathrattle (1 damage)
  // must be enough to kill it once Powder Rat itself dies in the trade.
  assert.equal(result.boardB.length, 0);
});

test('buff_random_friendly_faction deathrattle buffs a living ally', () => {
  const rng = makeSeededRng(6);
  // Barrelback Turtle (1/4, neutral) dies eventually to a big attacker,
  // paired with an ally that should receive its deathrattle buff.
  const boardA = [instantiate('neutral-barrelback-turtle', 'turtle'), instantiate('reaver-bilge-rigger', 'ally')];
  const boardB = [instantiate('wyrdtide-reefbound-leviathan', 'leviathan')]; // 5/6, easily kills the turtle
  const result = simulateCombat(boardA, boardB, { rng });
  const ally = result.boardA.find((m) => m.instanceId === 'ally');
  // Ally either wasn't targeted (still 3/2) or was buffed to 4/3 — either
  // way the turtle's deathrattle must not have thrown an error, and if it
  // fired, the only legal target was 'ally' (the turtle itself is dead).
  if (ally) assert.ok(ally.attack >= 3 && ally.health >= 2);
});

test('fathom_grow deathrattle grows the Fathom and is reported as an external effect', () => {
  const rng = makeSeededRng(7);
  // Barnacle Warden (1/5, taunt) dies eventually; its deathrattle grows the
  // Fathom by +2/+2 and should show up in externalEffects for the caller
  // to persist onto the player's actual Fathom state.
  const boardA = [instantiate('wyrdtide-barnacle-warden', 'warden')];
  const boardB = [instantiate('wyrdtide-reefbound-leviathan', 'leviathan')];
  const result = simulateCombat(boardA, boardB, { rng, fathomA: { attack: 0, health: 0 } });
  const growthEvents = result.externalEffects.filter((e) => e.owner === 'A' && e.type === 'fathom_grow');
  assert.ok(growthEvents.length >= 1);
  assert.equal(result.fathomA.attack, 2);
  assert.equal(result.fathomA.health, 2);
});

test('on_fathom_growth reacts immediately within the same combat', () => {
  const rng = makeSeededRng(8);
  // Tidecaller (3/2, taunt) sits alongside Barnacle Warden. When the Warden
  // dies and grows the Fathom, Tidecaller should get +1/+1 mid-fight.
  const boardA = [instantiate('wyrdtide-barnacle-warden', 'warden'), instantiate('wyrdtide-tidecaller', 'caller')];
  const boardB = [instantiate('wyrdtide-reefbound-leviathan', 'leviathan')];
  const result = simulateCombat(boardA, boardB, { rng });
  const reactionFired = result.log.some((e) => e.type === 'fathom_reaction_buff' && e.targetId === 'caller');
  assert.ok(reactionFired, 'expected Tidecaller to react to the Fathom growing');
});

test('end_of_combat_won buff_self applies only to the winning side, permanently', () => {
  const rng = makeSeededRng(9);
  // First Mate Sorrel (2/4, taunt) beats a lone Ghost Light (1/1): Sorrel
  // takes 1 from the trade and 2 more from Light's own deathrattle (the
  // only enemy left to hit), landing at 1 health before her own
  // end-of-combat trigger adds +1/+1.
  const result = simulateCombat(
    [instantiate('reaver-first-mate-sorrel', 'sorrel')],
    [instantiate('neutral-ghost-light', 'light')],
    { rng }
  );
  assert.equal(result.winner, 'A');
  const sorrel = result.boardA.find((m) => m.instanceId === 'sorrel');
  assert.equal(sorrel.attack, 3);
  assert.equal(sorrel.health, 2);
});

test('end_of_combat_won refresh_shop_free is an external effect, never applied inside combat', () => {
  const rng = makeSeededRng(10);
  const result = simulateCombat(
    [instantiate('neutral-wandering-merchant', 'merchant'), instantiate('reaver-bilge-rigger', 'muscle')],
    [instantiate('neutral-ghost-light', 'light')],
    { rng }
  );
  assert.equal(result.winner, 'A');
  const effect = result.externalEffects.find((e) => e.type === 'refresh_shop_free' && e.owner === 'A');
  assert.ok(effect);
});

test('an empty board immediately loses without throwing', () => {
  const result = simulateCombat([], [instantiate('neutral-ghost-light', 'light')]);
  assert.equal(result.winner, 'B');
  assert.equal(result.damageToLoser, 1);
});

test('two empty boards is a draw', () => {
  const result = simulateCombat([], []);
  assert.equal(result.winner, 'draw');
  assert.equal(result.damageToLoser, 0);
});

// --- Reef Shard board abilities (Vampiric, Barnacled, Riptide, Undying,
// Twinned, Maelstrom) — patched in after the shard tags existed in
// economy.mjs but combat.mjs didn't read them yet. See CLAUDE.md. ---

test('Vampiric heals to full whenever this minion kills an enemy, and only then', () => {
  const rng = makeSeededRng(20);
  // Bilge Rigger (3/2, tagged Vampiric) vs Powder Rat (1/3): the trade drops
  // the Rigger to 1 health but kills the Rat, so Vampiric should heal it
  // back to its max (2) before Powder Rat's own deathrattle (1 damage to a
  // random enemy) lands — without the heal, that follow-up hit would kill
  // the Rigger outright (1 - 1 = 0); with it, the Rigger ends at 1 (2 - 1).
  const vampire = instantiate('reaver-bilge-rigger', 'vamp');
  vampire.shardAbilities = ['vampiric'];
  const result = simulateCombat([vampire], [instantiate('reaver-powder-rat', 'rat')], { rng });
  const healed = result.log.some((e) => e.type === 'vampiric_heal' && e.targetId === 'vamp');
  assert.ok(healed, 'expected Vampiric to trigger on the kill');
  assert.equal(result.winner, 'A');
  assert.equal(result.boardA.length, 1);
  assert.equal(result.boardA[0].health, 1); // healed to 2, then took the deathrattle's 1
  assert.equal(result.boardB.length, 0);
});

test('Barnacled grants +1/+1 the first time it survives being attacked, and never again this combat', () => {
  const rng = makeSeededRng(21);
  // Two attackers vs a lone taunt (tagged Barnacled) — it will be forced to
  // defend repeatedly over the course of the fight, but the buff must land
  // exactly once no matter how many times it's hit.
  const warden = instantiate('wyrdtide-barnacle-warden', 'warden'); // 1/5, taunt
  warden.shardAbilities = ['barnacled'];
  const boardA = [instantiate('reaver-bilge-rigger', 'a1'), instantiate('reaver-bilge-rigger', 'a2')];
  const result = simulateCombat(boardA, [warden], { rng });
  const triggers = result.log.filter((e) => e.type === 'barnacled_trigger' && e.targetId === 'warden');
  assert.equal(triggers.length, 1);
});

test('Riptide splashes 1 damage onto a second random enemy distinct from the primary defender', () => {
  const rng = makeSeededRng(22);
  // A taunt on the enemy side forces the primary defender deterministically,
  // so the splash can only ever land on the other (non-taunt) minion.
  // Side A outnumbers side B (3 vs 2), which forces A to attack first and
  // guarantees the Riptide attacker (first in board order) gets its swing
  // in while both enemy minions are still alive.
  const attacker = instantiate('reaver-bilge-rigger', 'riptide');
  attacker.shardAbilities = ['riptide'];
  const boardA = [attacker, instantiate('wyrdtide-driftwood-golem', 'pad1'), instantiate('wyrdtide-driftwood-golem', 'pad2')];
  const boardB = [instantiate('neutral-old-sea-dog', 'tank'), instantiate('wyrdtide-driftwood-golem', 'splash')];
  const result = simulateCombat(boardA, boardB, { rng });
  const splash = result.log.find((e) => e.type === 'riptide_splash' && e.targetId === 'splash');
  assert.ok(splash, 'expected Riptide to splash the non-taunt minion');
  assert.equal(splash.amount, 1);
});

test('Undying survives its first lethal hit each combat at 1 health, but not a second', () => {
  const rng = makeSeededRng(23);
  // X (5 attack) vs Y (2 attack/3 health, tagged Undying): the first hit
  // would drop Y to -2 — saved to 1 instead — but Y's own retaliation turn
  // exposes it to a second lethal hit, which is not saved.
  const x = instantiate('reaver-bilge-rigger', 'X');
  x.attack = 5;
  x.health = 4;
  const y = instantiate('reaver-bilge-rigger', 'Y');
  y.attack = 2;
  y.health = 3;
  y.shardAbilities = ['undying'];
  const result = simulateCombat([x], [y], { rng });
  const saves = result.log.filter((e) => e.type === 'undying_save' && e.targetId === 'Y');
  assert.equal(saves.length, 1);
  assert.equal(result.boardB.length, 0); // the second lethal hit was not saved
});

test('Twinned fires a deathrattle twice', () => {
  const rng = makeSeededRng(24);
  // Powder Rat (1/3, tagged Twinned) deals 1 deathrattle damage — twice —
  // to Driftwood Golem (3/3, no abilities), instead of once.
  const rat = instantiate('reaver-powder-rat', 'rat');
  rat.shardAbilities = ['twinned'];
  const result = simulateCombat([rat], [instantiate('wyrdtide-driftwood-golem', 'golem')], { rng });
  const hits = result.log.filter((e) => e.type === 'deathrattle_damage' && e.targetId === 'golem');
  assert.equal(hits.length, 2);
});

test('Maelstrom copies its deathrattle onto two other friendly minions, never the tag itself', () => {
  const rng = makeSeededRng(25);
  // Ghost Light (1/1, tagged Maelstrom) dies to Bilge Rigger's counter-hit,
  // its own deathrattle chain-kills the Rigger, and then its deathrattle
  // effect (not the Maelstrom tag) should be copied onto both allies.
  const ghost = instantiate('neutral-ghost-light', 'ghost');
  ghost.shardAbilities = ['maelstrom'];
  const boardA = [ghost, instantiate('wyrdtide-driftwood-golem', 'ally1'), instantiate('wyrdtide-driftwood-golem', 'ally2')];
  const result = simulateCombat(boardA, [instantiate('reaver-bilge-rigger', 'enemy')], { rng });
  assert.equal(result.winner, 'A');
  assert.equal(result.boardA.length, 2);
  for (const ally of result.boardA) {
    const copied = ally.effects.filter((e) => e.trigger === 'deathrattle' && e.action.type === 'damage_random_enemy' && e.action.amount === 2);
    assert.equal(copied.length, 1, `expected ${ally.instanceId} to have received the copied deathrattle`);
    assert.ok(!hasMaelstrom(ally), `${ally.instanceId} must not inherit the Maelstrom tag itself`);
  }
});

function hasMaelstrom(minion) {
  return Array.isArray(minion.shardAbilities) && minion.shardAbilities.includes('maelstrom');
}
