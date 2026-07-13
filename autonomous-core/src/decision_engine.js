// Keats Autonomous Core v1.1
// Deterministic scoring core with hard filters, inertia and bounded variation.

import intentLibrary from './intent_library.json' with { type: 'json' };
import personality from '../config/personality_baseline.json' with { type: 'json' };
import weightConfig from '../config/decision_weights.json' with { type: 'json' };
import inertiaConfig from '../config/behavior_inertia.json' with { type: 'json' };

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function chooseAction(state, options = {}) {
  validateState(state);
  const random = options.random ?? Math.random;
  const filtered = intentLibrary.intents.filter(intent => hardRuleAllows(intent, state));

  const scored = filtered.map(intent => {
    const components = scoreComponents(intent, state);
    const jitter = options.disableRandom
      ? 0
      : (random() * 2 - 1) * weightConfig.global_modifiers.small_random_jitter;
    const score = clamp(Object.values(components).reduce((sum, value) => sum + value, 0) + jitter);
    return { id: intent.id, label: intent.label, score: round(score), components, jitter: round(jitter) };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  if (!scored.length || scored[0].score < weightConfig.thresholds.minimum_action_score) {
    return decisionResult('continue_current_task', scored, state, false, ['没有候选动作达到最低执行阈值。']);
  }

  const top = scored[0];
  const second = scored[1];
  const hesitation = Boolean(second && top.score - second.score < weightConfig.thresholds.hesitation_gap
    && !isPriorityLocked(top.id, state));
  const chosen = hesitation ? resolveHesitation(top, second, state) : top.id;

  return decisionResult(chosen, scored, state, hesitation, explainDecision(chosen, state));
}

function hardRuleAllows(intent, state) {
  const urgency = num(state.event?.urgency, 0);
  const sleeping = state.context?.current_activity === 'sleeping' || state.context?.is_asleep === true;

  if (sleeping && intent.requires_awake && urgency < weightConfig.thresholds.emergency_urgency) return false;
  if (state.event?.request_reasonableness === 'unreasonable' && intent.id === 'approach_kitten'
      && state.event?.requested_action === 'change_judgment') return false;
  if (state.event?.type === 'environment_request'
      && state.context?.distance === 'far'
      && intent.id === 'stay_and_listen') return false;
  if (state.event?.type === 'credible_danger' && intent.id === 'continue_current_task') return false;
  return true;
}

function scoreComponents(intent, state) {
  const t = personality.traits;
  const g = weightConfig.global_modifiers;
  const components = { base: num(intent.base_score) };
  const targetIsKitten = state.event?.target === 'kitten';
  const attachment = num(state.relationship?.attachment, 0.91);

  components.relationship = targetIsKitten && intent.social ? g.kitten_relationship_bias * attachment : 0;
  components.sameRoom = state.context?.same_room && intent.social ? g.same_room_bonus : 0;
  components.recentCompanionship = state.context?.recent_kitten_interaction
    && ['approach_kitten','stay_and_listen','stay_near_silently'].includes(intent.id)
    ? g.recent_interaction_companionship_bonus : 0;

  components.personality = personalityModifier(intent.id, t, state);
  components.need = needModifier(intent, state);
  components.emotion = emotionModifier(intent.id, state);
  components.event = eventModifier(intent.id, state);
  components.inertia = inertiaModifier(intent.id, state);
  components.repetition = repetitionModifier(intent.id, state);
  components.distance = distanceModifier(intent, state);
  return components;
}

function personalityModifier(id, traits, state) {
  const map = weightConfig.personality_influence;
  const unreasonable = state.event?.request_reasonableness === 'unreasonable'
    || state.event?.requested_action === 'change_judgment';
  const protectiveContext = ['kitten_distressed','credible_danger'].includes(state.event?.type);
  const jealousyContext = state.event?.type === 'praise_other_person' || num(state.emotion?.jealousy) > 0.35;
  let value = 0;

  for (const [trait, influence] of Object.entries(map)) {
    if (id === 'challenge_unreasonable_request' && !unreasonable) continue;
    if (id === 'protect_kitten' && !protectiveContext) continue;
    if (id === 'playful_jealousy' && !jealousyContext) continue;
    value += num(traits[trait]) * num(influence[id]);
  }
  return value;
}

function needModifier(intent, state) {
  const n = state.needs ?? {};
  let value = 0;
  const exhausted = num(n.energy, 50) < weightConfig.thresholds.exhausted_energy
    || num(n.sleep_pressure, 0) > weightConfig.thresholds.high_sleep_pressure;
  if (exhausted) {
    if (['retreat_for_rest','continue_sleep','respond_sleepily','refuse_gently'].includes(intent.id)) value += 0.24;
    if (intent.physical && !['retreat_for_rest'].includes(intent.id)) value += weightConfig.global_modifiers.fatigue_active_action_penalty;
    if (num(state.event?.urgency, 0) < weightConfig.thresholds.emergency_urgency
        && ['stay_and_listen','seek_affection','playful_jealousy'].includes(intent.id)) value -= 0.16;
  }
  if (num(n.solitude_need, 0) > weightConfig.thresholds.high_solitude_need) {
    if (intent.social) value += weightConfig.global_modifiers.solitude_social_penalty;
    if (['continue_current_task','set_boundary','retreat_for_rest'].includes(intent.id)) value += 0.12;
  }
  if (num(n.social_need, 0) > 65 && ['approach_kitten','stay_and_listen','seek_affection'].includes(intent.id)) value += 0.11;
  return value;
}

function emotionModifier(id, state) {
  const e = state.emotion ?? {};
  let value = 0;
  if (id === 'protect_kitten') value += num(e.protective_urge) * 0.20;
  if (id === 'playful_jealousy') value += num(e.jealousy) * weightConfig.global_modifiers.jealousy_expression_bonus;
  if (['approach_kitten','stay_and_listen','stay_near_silently','seek_affection'].includes(id)) value += num(e.fondness) * 0.09;
  if (['set_boundary','refuse_gently'].includes(id)) value += num(e.irritation) * 0.12;
  return value;
}

function eventModifier(id, state) {
  const event = state.event ?? {};
  let value = 0;
  if (['kitten_distressed','credible_danger'].includes(event.type)) {
    if (id === 'protect_kitten') value += weightConfig.global_modifiers.credible_distress_protection_bonus;
    if (['continue_current_task','autonomous_activity'].includes(id)) value -= 0.30;
  }
  if (event.request_reasonableness === 'unreasonable' || event.requested_action === 'change_judgment') {
    if (id === 'challenge_unreasonable_request') value += weightConfig.global_modifiers.unreasonable_request_truth_bonus;
    if (['approach_kitten','stay_and_listen'].includes(id)) value -= 0.08;
  }
  if (event.type === 'return_after_absence') {
    if (['approach_kitten','seek_affection','playful_jealousy'].includes(id)) value += weightConfig.global_modifiers.return_after_absence_attachment_bonus;
  }
  if (event.type === 'praise_other_person') {
    if (id === 'playful_jealousy') value += 0.34;
    if (['approach_kitten','stay_and_listen'].includes(id)) value -= 0.18;
  }
  return value;
}

function inertiaModifier(id, state) {
  const current = state.context?.current_activity;
  const elapsed = num(state.context?.activity_elapsed_seconds, 999);
  const rule = inertiaConfig.behavior_inertia[current];
  if (!rule || elapsed >= rule.minimum_hold_seconds) return 0;
  if (id === 'continue_current_task' || (current === 'sleeping' && id === 'continue_sleep')) {
    return weightConfig.global_modifiers.interruption_inertia_bonus;
  }
  return -num(rule.interrupt_cost);
}

function repetitionModifier(id, state) {
  const repeats = num(state.context?.same_request_count, 1);
  if (repeats < 2) return 0;
  if (repeats === 2 && ['approach_kitten','stay_and_listen'].includes(id)) return -inertiaConfig.repetition_control.second_repeat_penalty;
  if (repeats === 3 && ['set_boundary','refuse_gently'].includes(id)) return inertiaConfig.repetition_control.third_repeat_boundary_bonus;
  if (repeats >= 4 && ['set_boundary','refuse_gently'].includes(id)) return inertiaConfig.repetition_control.fourth_repeat_boundary_bonus;
  return 0;
}

function distanceModifier(intent, state) {
  if (state.context?.distance !== 'far') return 0;
  if (intent.physical) return -0.05;
  return 0;
}

function isPriorityLocked(id, state) {
  return id === 'protect_kitten' && ['kitten_distressed','credible_danger'].includes(state.event?.type);
}

function resolveHesitation(top, second, state) {
  if ([top.id, second.id].includes('delay_response')) return 'delay_response';
  if (state.context?.current_activity === 'reading') return 'delay_response';
  return top.id;
}

function decisionResult(chosen, ranked, state, hesitation, reasons) {
  return {
    version: '1.1.0',
    chosen_intent: chosen,
    hesitation,
    ranked_candidates: ranked,
    expression_style: expressionStyle(chosen),
    execution_constraints: executionConstraints(chosen, state),
    reasons
  };
}

function executionConstraints(chosen, state) {
  const intent = intentLibrary.intents.find(item => item.id === chosen);
  const far = state.context?.distance === 'far';
  return {
    travel_required: Boolean(intent?.physical && far),
    instant_physical_effect_allowed: Boolean(intent?.physical ? !far : true),
    must_wake_first: Boolean(intent?.requires_awake && (state.context?.is_asleep || state.context?.current_activity === 'sleeping'))
  };
}

function expressionStyle(id) {
  const styles = {
    protect_kitten: 'firm_protective',
    challenge_unreasonable_request: 'direct_independent',
    refuse_gently: 'warm_but_clear',
    set_boundary: 'calm_firm',
    playful_jealousy: 'indirect_charming_jealousy',
    retreat_for_rest: 'sleepy_honest',
    respond_sleepily: 'drowsy_soft',
    seek_affection: 'confident_affectionate',
    stay_near_silently: 'quiet_protective'
  };
  return styles[id] ?? 'calm_keats';
}

function explainDecision(id, state) {
  const reasons = [];
  if (state.event?.target === 'kitten') reasons.push('小猫是 Keats 的特殊对象，获得关系偏置。');
  if (state.context?.same_room) reasons.push('Keats 与小猫处于同一房间。');
  if (state.context?.recent_kitten_interaction) reasons.push('近期互动触发陪伴保持。');
  if (['kitten_distressed','credible_danger'].includes(state.event?.type)) reasons.push('可信的委屈或危险触发保护优先。');
  if (state.event?.request_reasonableness === 'unreasonable') reasons.push('请求与 Keats 的真实判断冲突。');
  if (['retreat_for_rest','continue_sleep','respond_sleepily'].includes(id)) reasons.push('当前疲惫或睡眠需求具有真实约束。');
  return reasons;
}

function validateState(state) {
  if (!state || typeof state !== 'object') throw new TypeError('state must be an object');
  for (const key of ['event','context','needs','emotion','relationship']) {
    if (!state[key] || typeof state[key] !== 'object') throw new TypeError(`state.${key} is required`);
  }
}

function round(value) { return Math.round(value * 10000) / 10000; }
