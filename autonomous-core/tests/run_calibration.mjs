import fs from 'node:fs';
import { chooseAction } from '../src/decision_engine.js';

const suite = JSON.parse(fs.readFileSync(new URL('./scenario_suite_v1.json', import.meta.url), 'utf8'));
let failures = 0;
for (const scenario of suite.scenarios) {
  const result = chooseAction(scenario.state, { disableRandom: true });
  const expected = scenario.expected_any_of.includes(result.chosen_intent);
  const forbidden = scenario.forbidden.includes(result.chosen_intent);
  const passed = expected && !forbidden;
  if (!passed) failures += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${scenario.id}: ${result.chosen_intent}`);
  if (!passed) console.log('  top:', result.ranked_candidates.slice(0, 4));
}
if (failures) {
  console.error(`\n${failures} calibration scenario(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${suite.scenarios.length} calibration scenarios passed.`);
}
