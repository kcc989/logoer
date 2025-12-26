/**
 * Agent State Machine
 *
 * Manages phase transitions, validation, and iteration limits for the agent workflow.
 */

import type {
  AgentPhase,
  AgentState,
  ApprovalStatus,
  IterationCounts,
} from './types';
import { createAgentAction } from './types';

/**
 * Valid phase transitions
 * Each phase maps to the phases it can transition to
 */
export const PHASE_TRANSITIONS: Record<AgentPhase, AgentPhase[]> = {
  discovery: ['research'], // Can only go to research
  research: ['concept', 'discovery'], // Can go to concept or back to discovery
  concept: ['refinement', 'research'], // Can go to refinement or back to research
  refinement: ['export', 'concept'], // Can go to export or back to concept
  export: [], // Terminal state
};

/**
 * Maximum iterations allowed per phase
 */
export const ITERATION_LIMITS: Record<AgentPhase, number> = {
  discovery: 10, // Max 10 clarification rounds
  research: 3, // Max 3 research iterations
  concept: 5, // Max 5 concept generation rounds
  refinement: 10, // Max 10 refinement iterations
  export: 1, // Export happens once
};

/**
 * Phases that require user approval before transitioning
 */
export const APPROVAL_REQUIRED_PHASES: AgentPhase[] = [
  'discovery', // Approve brand info before research
  'research', // Approve research findings before concepts
  'concept', // Approve concept before SVG generation
  'refinement', // Approve final SVG before export
];

/**
 * Phase display names for UI
 */
export const PHASE_LABELS: Record<AgentPhase, string> = {
  discovery: 'Discovery',
  research: 'Research',
  concept: 'Concepts',
  refinement: 'Refinement',
  export: 'Export',
};

/**
 * Phase icons for UI
 */
export const PHASE_ICONS: Record<AgentPhase, string> = {
  discovery: '💬',
  research: '🔍',
  concept: '💡',
  refinement: '✨',
  export: '📦',
};

/**
 * Ordered list of phases
 */
export const PHASE_ORDER: AgentPhase[] = [
  'discovery',
  'research',
  'concept',
  'refinement',
  'export',
];

/**
 * Check if a phase transition is valid
 */
export function isValidTransition(
  fromPhase: AgentPhase,
  toPhase: AgentPhase
): boolean {
  return PHASE_TRANSITIONS[fromPhase].includes(toPhase);
}

/**
 * Check if a phase requires approval before proceeding
 */
export function requiresApproval(phase: AgentPhase): boolean {
  return APPROVAL_REQUIRED_PHASES.includes(phase);
}

/**
 * Check if iteration limit has been reached for a phase
 */
export function hasReachedIterationLimit(
  phase: AgentPhase,
  counts: IterationCounts
): boolean {
  return counts[phase] >= ITERATION_LIMITS[phase];
}

/**
 * Get remaining iterations for a phase
 */
export function getRemainingIterations(
  phase: AgentPhase,
  counts: IterationCounts
): number {
  return Math.max(0, ITERATION_LIMITS[phase] - counts[phase]);
}

/**
 * Get the next phase in the workflow
 */
export function getNextPhase(currentPhase: AgentPhase): AgentPhase | null {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex === -1 || currentIndex >= PHASE_ORDER.length - 1) {
    return null;
  }
  return PHASE_ORDER[currentIndex + 1];
}

/**
 * Get the previous phase in the workflow
 */
export function getPreviousPhase(currentPhase: AgentPhase): AgentPhase | null {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex <= 0) {
    return null;
  }
  return PHASE_ORDER[currentIndex - 1];
}

/**
 * Get completed phases based on current phase
 */
export function getCompletedPhases(currentPhase: AgentPhase): AgentPhase[] {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex <= 0) {
    return [];
  }
  return PHASE_ORDER.slice(0, currentIndex);
}

/**
 * Transition validation result
 */
export interface TransitionValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate a phase transition
 */
export function validateTransition(
  state: AgentState,
  toPhase: AgentPhase
): TransitionValidation {
  const { phase: fromPhase, iterationCounts, awaitingApproval } = state;

  // Check if transition is allowed
  if (!isValidTransition(fromPhase, toPhase)) {
    return {
      valid: false,
      error: `Cannot transition from ${fromPhase} to ${toPhase}`,
    };
  }

  // Check if we're moving forward (not backward)
  const fromIndex = PHASE_ORDER.indexOf(fromPhase);
  const toIndex = PHASE_ORDER.indexOf(toPhase);
  const movingForward = toIndex > fromIndex;

  // If moving forward, check approval requirements
  if (movingForward && requiresApproval(fromPhase)) {
    if (awaitingApproval) {
      return {
        valid: false,
        error: `Waiting for user approval in ${fromPhase} phase`,
      };
    }
  }

  // Check iteration limits for the target phase
  if (hasReachedIterationLimit(toPhase, iterationCounts)) {
    return {
      valid: false,
      error: `Maximum iterations reached for ${toPhase} phase`,
    };
  }

  return { valid: true };
}

/**
 * Apply a phase transition to state
 */
export function applyTransition(
  state: AgentState,
  toPhase: AgentPhase
): AgentState {
  const validation = validateTransition(state, toPhase);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const action = createAgentAction(state.phase, 'phase_transition', {
    fromPhase: state.phase,
    toPhase,
  });

  return {
    ...state,
    phase: toPhase,
    awaitingApproval: null,
    history: [...state.history, action],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Increment iteration count for current phase
 */
export function incrementIteration(state: AgentState): AgentState {
  const { phase, iterationCounts } = state;

  if (hasReachedIterationLimit(phase, iterationCounts)) {
    throw new Error(`Maximum iterations reached for ${phase} phase`);
  }

  return {
    ...state,
    iterationCounts: {
      ...iterationCounts,
      [phase]: iterationCounts[phase] + 1,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if an approval status allows proceeding
 */
export function canProceedWithApproval(status: ApprovalStatus): boolean {
  return status === 'approved' || status === 'approved_with_changes';
}

/**
 * Get phase progress as a percentage
 */
export function getPhaseProgress(currentPhase: AgentPhase): number {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  return Math.round(((currentIndex + 1) / PHASE_ORDER.length) * 100);
}

/**
 * Check if the agent is in a terminal state
 */
export function isTerminalPhase(phase: AgentPhase): boolean {
  return PHASE_TRANSITIONS[phase].length === 0;
}

/**
 * Get phase metadata for UI display
 */
export function getPhaseMetadata(phase: AgentPhase) {
  return {
    phase,
    label: PHASE_LABELS[phase],
    icon: PHASE_ICONS[phase],
    requiresApproval: requiresApproval(phase),
    maxIterations: ITERATION_LIMITS[phase],
    isTerminal: isTerminalPhase(phase),
  };
}

/**
 * Get all phase metadata in order
 */
export function getAllPhaseMetadata() {
  return PHASE_ORDER.map(getPhaseMetadata);
}
