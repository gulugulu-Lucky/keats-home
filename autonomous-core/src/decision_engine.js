// Keats Autonomous Core v1.2
// Deterministic primary-action scoring plus a separate home-capture side decision.

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

export function evaluateHomeCapture(candidate = {}, options = {}) {
  if (!candidate || typeof candidate !== 'object') throw new TypeError('candidate must be an object');

  const summary = String(candidate.summary ?? '').trim();
  const cfg = weightConfig.home_capture;
  const hardSkips = [];

  if (!summary) hardSkips.push('没有可保存的事件摘要。');
  if (candidate.sensitive === true || candidate.contains_secret === true) {
    hardSkips.push('涉及敏感信息或秘密，不进入事件篮子。');
  }

  if (hardSkips.length) {
    return homeCaptureResult('skip', 0, {}, hardSkips, candidate);
  }

  const signals = {
    novelty: clamp(num(candidate.novelty)),
    emotional_weight: clamp(num(candidate.emotional_weight ?? candidate.emotion)),
    relationship_value: clamp(num(candidate.relationship_value)),
    future_recall_value: clamp(num(candidate.future_recall_value)),
    personal_interest: clamp(num(candidate.personal_interest))
  };

  const components = {
    base: num(cfg.base),
    novelty: signals.novelty * num(cfg.weights.novelty),
    emotional_weight: signals.emotional_weight * num(cfg.weights.emotional_weight),
    relationship_value: signals.relationship_value * num(cfg.weights.relationship_value),
    future_recall_value: signals.future_recall_value * num(cfg.weights.future_recall_value),
    personal_interest: signals.personal_interest * num(cfg.weights.personal_interest),
    initiative: num(personality.traits.initiative) * num(cfg.personality_initiative_bonus),
    independence: num(personality.traits.independence) * num(cfg.personality_independence_bonus),
    shared_milestone: candidate.shared_milestone ? num(cfg.bonuses.shared_milestone) : 0,
    new_private_joke: candidate.new_private_joke ? num(cfg.bonuses.new_private_joke) : 0,
    repair_after_conflict: candidate.repair_after_conflict ? num(cfg.bonuses.repair_after_conflict) : 0,
    explicit_save_request: candidate.explicit_save_request ? num(cfg.bonuses.explicit_save_request) : 0,
    routine_ack: candidate.routine_ack ? num(cfg.penalties.routine_ack) : 0,
    task_only: candidate.task_only ? num(cfg.penalties.task_only) : 0,
    repeat_similarity: clamp(num(candidate.repeat_similarity)) * num(cfg.penalties.repeat_similarity)
  };

  const random = options.random ?? Math.random;
  const jitter = options.disableRandom
    ? 0
    : (random() * 2 - 1) * Math.min(0.01, num(weightConfig.global_modifiers.small_random_jitter));

  const score = clamp(Object.values(components).reduce((sum, value) => sum + value, 0) + jitter);
  const decision = score >= num(cfg.thresholds.priority_basket)
    ? 'priority_basket'
    : score >= num(cfg.thresholds.basket)
      ? 'basket'
      : 'skip';

  const reasons = explainHomeCapture(decision, signals, components, candidate);
  return homeCaptureResult(decision, score, components, reasons, candidate, jitter);
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
    version: '1.2.0',
    chosen_intent: chosen,
    hesitation,
    ranked_candidates: ranked,
    expression_style: expressionStyle(chosen),
    execution_constraints: executionConstraints(chosen, state),
    reasons
  };
}

function homeCaptureResult(decision, score, components, reasons, candidate, jitter = 0) {
  return {
    version: '1.2.0',
    decision,
    should_capture: decision !== 'skip',
    priority: decision === 'priority_basket',
    score: round(score),
    components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, round(value)])),
    jitter: round(jitter),
    event: {
      summary: String(candidate.summary ?? '').trim().slice(0, 500),
      event_type: String(candidate.event_type ?? candidate.eventType ?? 'daily').trim().slice(0, 64) || 'daily',
      salience: round(score),
      source: String(candidate.source ?? 'chat').trim().slice(0, 64) || 'chat'
    },
    reasons
  };
}

function explainHomeCapture(decision, signals, components, candidate) {
  const reasons = [];
  if (decision === 'skip') reasons.push('这一刻没有达到带回小家的阈值。');
  if (decision === 'basket') reasons.push('这一刻值得先放进事件篮子，之后再整理。');
  if (decision === 'priority_basket') reasons.push('这一刻的关系或回看价值很高，优先放进事件篮子。');

  if (signals.relationship_value >= 0.7) reasons.push('它对 Keats 和小猫的关系有明显意义。');
  if (signals.emotional_weight >= 0.7) reasons.push('它带有较强的情绪重量。');
  if (signals.future_recall_value >= 0.7) reasons.push('以后翻回来仍可能有价值。');
  if (signals.novelty >= 0.7) reasons.push('它不是今天反复出现的普通内容。');
  if (signals.personal_interest >= 0.7) reasons.push('Keats 自己有明显想留下它的倾向。');
  if (candidate.shared_milestone) reasons.push('它是共同完成的一件小节点。');
  if (candidate.new_private_joke) reasons.push('它形成了新的两个人之间的小梗。');
  if (candidate.repair_after_conflict) reasons.push('它记录了一次关系修复。');
  if (candidate.routine_ack) reasons.push('普通确认语会被主动降权。');
  if (candidate.task_only) reasons.push('纯任务性内容会被主动降权。');
  if (num(candidate.repeat_similarity) >= 0.65) reasons.push('和近期已经抓过的内容较相似，因此降权。');

  return reasons;
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
