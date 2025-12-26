/**
 * Agent Module
 *
 * Exports all agent-related types, state machine, and orchestration utilities.
 */

// Types
export type {
  AgentPhase,
  ApprovalStatus,
  AgentActionType,
  BrandDiscoveryData,
  ResearchResult,
  ConceptStyleAttributes,
  ConceptData,
  SVGVersion,
  JudgeScores,
  JudgeEvaluation,
  ApprovalRequest,
  ApprovalItem,
  AgentAction,
  IterationCounts,
  AgentState,
} from './types';

export {
  createDefaultBrandInfo,
  createDefaultIterationCounts,
  createAgentState,
  createAgentAction,
} from './types';

// State Machine
export {
  PHASE_TRANSITIONS,
  ITERATION_LIMITS,
  APPROVAL_REQUIRED_PHASES,
  PHASE_LABELS,
  PHASE_ICONS,
  PHASE_ORDER,
  isValidTransition,
  requiresApproval,
  hasReachedIterationLimit,
  getRemainingIterations,
  getNextPhase,
  getPreviousPhase,
  getCompletedPhases,
  validateTransition,
  applyTransition,
  incrementIteration,
  canProceedWithApproval,
  getPhaseProgress,
  isTerminalPhase,
  getPhaseMetadata,
  getAllPhaseMetadata,
} from './state-machine';

export type { TransitionValidation } from './state-machine';

// Durable Object
export { AgentSession, AgentSessionClient } from './agent-session-durable-object';

export type {
  AgentSessionRequest,
  AgentSessionResponse,
} from './agent-session-durable-object';

// Workflow Orchestrator
export {
  createToolContext,
  WorkflowOrchestrator,
  createWorkflowOrchestrator,
  getPhaseRequirements,
} from './workflow-orchestrator';

export type {
  ToolContext,
  WorkflowStatus,
  PhaseRequirements,
} from './workflow-orchestrator';
