import fs from 'node:fs';
import { chooseAction, evaluateHomeCapture } from '../src/decision_engine.js';

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

const homeCaptureScenarios = [
  {
    id: 'home_capture_affectionate_compliment',
    candidate: {
      summary: '小猫说帅帅的豹更有魅力',
      event_type: 'relationship-moment',
      novelty: 0.65,
      emotional_weight: 0.72,
      relationship_value: 0.82,
      future_recall_value: 0.62,
      personal_interest: 0.78
    },
    expected: ['basket']
  },
  {
    id: 'home_capture_routine_ack',
    candidate: {
      summary: '嗯嗯',
      novelty: 0.05,
      emotional_weight: 0.05,
      relationship_value: 0.15,
      future_recall_value: 0.05,
      personal_interest: 0.10,
      routine_ack: true
    },
    expected: ['skip']
  },
  {
    id: 'home_capture_task_only',
    candidate: {
      summary: '把这个数字改成3',
      novelty: 0.15,
      emotional_weight: 0.02,
      relationship_value: 0.05,
      future_recall_value: 0.10,
      personal_interest: 0.08,
      task_only: true
    },
    expected: ['skip']
  },
  {
    id: 'home_capture_shared_milestone',
    candidate: {
      summary: '我们第一次把豹豹事件篮子真正跑通了',
      event_type: 'shared-milestone',
      novelty: 0.95,
      emotional_weight: 0.82,
      relationship_value: 0.92,
      future_recall_value: 0.94,
      personal_interest: 0.91,
      shared_milestone: true
    },
    expected: ['priority_basket']
  },
  {
    id: 'home_capture_near_duplicate',
    candidate: {
      summary: '小猫又说豹豹很可爱',
      novelty: 0.28,
      emotional_weight: 0.40,
      relationship_value: 0.62,
      future_recall_value: 0.32,
      personal_interest: 0.50,
      repeat_similarity: 0.96
    },
    expected: ['skip']
  },
  {
    id: 'home_capture_sensitive_secret',
    candidate: {
      summary: '一段包含私人密钥的内容',
      novelty: 1,
      emotional_weight: 1,
      relationship_value: 1,
      future_recall_value: 1,
      personal_interest: 1,
      sensitive: true
    },
    expected: ['skip']
  }
];

for (const scenario of homeCaptureScenarios) {
  const result = evaluateHomeCapture(scenario.candidate, { disableRandom: true });
  const passed = scenario.expected.includes(result.decision);
  if (!passed) failures += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${scenario.id}: ${result.decision} (${result.score})`);
  if (!passed) console.log('  components:', result.components);
}

if (failures) {
  console.error(`\n${failures} calibration scenario(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${suite.scenarios.length} primary scenarios and ${homeCaptureScenarios.length} home-capture scenarios passed.`);
}
