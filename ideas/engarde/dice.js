// En Garde! — The Season in Paris
// dice.js — dice and random helpers. MIT License.

function d6() {
  return 1 + Math.floor(Math.random() * 6);
}

function roll2d6() {
  return d6() + d6();
}

function roll3d6() {
  return d6() + d6() + d6();
}

function rollDice(count, sides) {
  let total = 0;
  for (let i = 0; i < count; i++) total += 1 + Math.floor(Math.random() * sides);
  return total;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function chance(probability) {
  return Math.random() < probability;
}
