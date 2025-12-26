/**
 * Workflow Orchestrator
 *
 * Coordinates the agent workflow, managing tool execution context,
 * state updates, and phase transitions.
 */

import type {
  AgentState,
  AgentPhase,
  BrandDiscoveryData,
  ResearchResult,
  ConceptData,
  SVGVersion,
  JudgeEvaluation,
  ApprovalRequest,
  ApprovalItem,
  ApprovalStatus,
} from './types';
import { createAgentAction } from './types';
import { AgentSessionClient } from './agent-session-durable-object';
import {
  PHASE_ORDER,
  getNextPhase,
  requiresApproval,
  hasReachedIterationLimit,
  getRemainingIterations,
  ITERATION_LIMITS,
} from './state-machine';

/**
 * Tool execution context passed to TanStack AI tool handlers
 */
export interface ToolContext {
  sessionClient: AgentSessionClient;
  agentState: AgentState;
  updateState: (updates: Partial<AgentState>) => Promise<AgentState>;
  transitionPhase: (phase: AgentPhase) => Promise<AgentState>;
  incrementIteration: () => Promise<AgentState>;
  logAction: (
    type: 'user_input' | 'agent_action' | 'tool_call' | 'error',
    data: Record<string, unknown>
  ) => Promise<AgentState>;
  env: Env;
}

/**
 * Create tool context for a session
 */
export async function createToolContext(
  env: Env,
  sessionId: string,
  userId: string
): Promise<ToolContext> {
  const sessionClient = new AgentSessionClient(env.AGENT_SESSION, sessionId);
  const agentState = await sessionClient.getOrCreateState(userId);

  return {
    sessionClient,
    agentState,
    updateState: async (updates) => sessionClient.updateState(updates),
    transitionPhase: async (phase) => sessionClient.transitionPhase(phase),
    incrementIteration: async () => sessionClient.incrementIteration(),
    logAction: async (type, data) =>
      sessionClient.logAction(agentState.phase, type, data),
    env,
  };
}

/**
 * Workflow orchestrator for managing agent execution
 */
export class WorkflowOrchestrator {
  constructor(
    private sessionClient: AgentSessionClient,
    private env: Env
  ) {}

  /**
   * Get current state
   */
  async getState(): Promise<AgentState | null> {
    return this.sessionClient.getState();
  }

  /**
   * Update brand discovery data
   */
  async updateBrandInfo(
    updates: Partial<BrandDiscoveryData>
  ): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    const updatedBrandInfo = {
      ...state.brandInfo,
      ...updates,
    };

    return this.sessionClient.updateState({ brandInfo: updatedBrandInfo });
  }

  /**
   * Add research results
   */
  async addResearchResults(results: ResearchResult[]): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    return this.sessionClient.updateState({
      researchResults: [...state.researchResults, ...results],
    });
  }

  /**
   * Add concepts
   */
  async addConcepts(concepts: ConceptData[]): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    return this.sessionClient.updateState({
      concepts: [...state.concepts, ...concepts],
    });
  }

  /**
   * Update a concept with evaluation or approval
   */
  async updateConcept(
    conceptId: string,
    updates: Partial<ConceptData>
  ): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    const updatedConcepts = state.concepts.map((c) =>
      c.id === conceptId ? { ...c, ...updates } : c
    );

    return this.sessionClient.updateState({ concepts: updatedConcepts });
  }

  /**
   * Select a concept for SVG generation
   */
  async selectConcept(conceptId: string): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    const concept = state.concepts.find((c) => c.id === conceptId);
    if (!concept) {
      throw new Error('Concept not found');
    }

    if (concept.approvalStatus !== 'approved') {
      throw new Error('Concept must be approved before selection');
    }

    return this.sessionClient.updateState({ selectedConceptId: conceptId });
  }

  /**
   * Add an SVG version
   */
  async addSVGVersion(version: SVGVersion): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    return this.sessionClient.updateState({
      svgVersions: [...state.svgVersions, version],
      currentSvgVersionId: version.id,
    });
  }

  /**
   * Update an SVG version with evaluation or approval
   */
  async updateSVGVersion(
    versionId: string,
    updates: Partial<SVGVersion>
  ): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    const updatedVersions = state.svgVersions.map((v) =>
      v.id === versionId ? { ...v, ...updates } : v
    );

    return this.sessionClient.updateState({ svgVersions: updatedVersions });
  }

  /**
   * Request user approval before phase transition
   */
  async requestApproval(
    items: ApprovalItem[],
  ): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    const approval: ApprovalRequest = {
      phase: state.phase,
      items,
      requestedAt: new Date().toISOString(),
    };

    return this.sessionClient.updateState({ awaitingApproval: approval });
  }

  /**
   * Handle user approval response
   */
  async handleApproval(
    itemId: string,
    status: ApprovalStatus,
    feedback?: string
  ): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    if (!state.awaitingApproval) {
      throw new Error('No pending approval request');
    }

    // Find and update the item
    const item = state.awaitingApproval.items.find((i) => i.id === itemId);
    if (!item) {
      throw new Error('Approval item not found');
    }

    // Update the corresponding entity based on type
    let updatedState: AgentState = state;

    switch (item.type) {
      case 'concept': {
        const updatedConcepts = state.concepts.map((c) =>
          c.id === itemId
            ? { ...c, approvalStatus: status, userFeedback: feedback }
            : c
        );
        updatedState = await this.sessionClient.updateState({
          concepts: updatedConcepts,
        });
        break;
      }
      case 'svg': {
        const updatedVersions = state.svgVersions.map((v) =>
          v.id === itemId
            ? { ...v, approvalStatus: status, userFeedback: feedback }
            : v
        );
        updatedState = await this.sessionClient.updateState({
          svgVersions: updatedVersions,
        });
        break;
      }
    }

    // Log the approval action
    await this.sessionClient.logAction(state.phase, 'approval', {
      itemId,
      itemType: item.type,
      status,
      feedback,
    });

    // Clear approval request if approved
    if (status === 'approved' || status === 'approved_with_changes') {
      updatedState = await this.sessionClient.updateState({
        awaitingApproval: null,
      });
    }

    return updatedState;
  }

  /**
   * Attempt to transition to the next phase
   */
  async tryAdvancePhase(): Promise<{
    advanced: boolean;
    state: AgentState;
    reason?: string;
  }> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    const nextPhase = getNextPhase(state.phase);
    if (!nextPhase) {
      return { advanced: false, state, reason: 'Already at final phase' };
    }

    // Check if approval is required and pending
    if (requiresApproval(state.phase) && state.awaitingApproval) {
      return {
        advanced: false,
        state,
        reason: 'Waiting for user approval',
      };
    }

    // Check iteration limits for next phase
    if (hasReachedIterationLimit(nextPhase, state.iterationCounts)) {
      return {
        advanced: false,
        state,
        reason: `Maximum iterations reached for ${nextPhase} phase`,
      };
    }

    // Perform the transition
    const newState = await this.sessionClient.transitionPhase(nextPhase);
    return { advanced: true, state: newState };
  }

  /**
   * Go back to a previous phase
   */
  async goBackToPhase(targetPhase: AgentPhase): Promise<AgentState> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    const currentIndex = PHASE_ORDER.indexOf(state.phase);
    const targetIndex = PHASE_ORDER.indexOf(targetPhase);

    if (targetIndex >= currentIndex) {
      throw new Error('Can only go back to earlier phases');
    }

    return this.sessionClient.transitionPhase(targetPhase);
  }

  /**
   * Get workflow status summary
   */
  async getWorkflowStatus(): Promise<WorkflowStatus> {
    const state = await this.sessionClient.getState();
    if (!state) {
      throw new Error('No active session');
    }

    const currentPhaseIndex = PHASE_ORDER.indexOf(state.phase);
    const progress = Math.round(
      ((currentPhaseIndex + 1) / PHASE_ORDER.length) * 100
    );

    return {
      sessionId: state.sessionId,
      currentPhase: state.phase,
      progress,
      completedPhases: PHASE_ORDER.slice(0, currentPhaseIndex),
      remainingPhases: PHASE_ORDER.slice(currentPhaseIndex + 1),
      iterationCounts: state.iterationCounts,
      remainingIterations: {
        discovery: getRemainingIterations('discovery', state.iterationCounts),
        research: getRemainingIterations('research', state.iterationCounts),
        concept: getRemainingIterations('concept', state.iterationCounts),
        refinement: getRemainingIterations('refinement', state.iterationCounts),
        export: getRemainingIterations('export', state.iterationCounts),
      },
      awaitingApproval: state.awaitingApproval !== null,
      conceptCount: state.concepts.length,
      approvedConceptCount: state.concepts.filter(
        (c) => c.approvalStatus === 'approved'
      ).length,
      svgVersionCount: state.svgVersions.length,
      hasSelectedConcept: state.selectedConceptId !== null,
      hasFinalSVG:
        state.svgVersions.some((v) => v.approvalStatus === 'approved') || false,
    };
  }
}

/**
 * Workflow status summary
 */
export interface WorkflowStatus {
  sessionId: string;
  currentPhase: AgentPhase;
  progress: number;
  completedPhases: AgentPhase[];
  remainingPhases: AgentPhase[];
  iterationCounts: {
    discovery: number;
    research: number;
    concept: number;
    refinement: number;
    export: number;
  };
  remainingIterations: {
    discovery: number;
    research: number;
    concept: number;
    refinement: number;
    export: number;
  };
  awaitingApproval: boolean;
  conceptCount: number;
  approvedConceptCount: number;
  svgVersionCount: number;
  hasSelectedConcept: boolean;
  hasFinalSVG: boolean;
}

/**
 * Create a workflow orchestrator for a session
 */
export function createWorkflowOrchestrator(
  env: Env,
  sessionId: string
): WorkflowOrchestrator {
  const sessionClient = new AgentSessionClient(env.AGENT_SESSION, sessionId);
  return new WorkflowOrchestrator(sessionClient, env);
}

/**
 * Get phase requirements for display
 */
export function getPhaseRequirements(phase: AgentPhase): PhaseRequirements {
  switch (phase) {
    case 'discovery':
      return {
        phase,
        description: 'Gather brand information and preferences',
        requiredFields: [
          'brandName',
          'industry',
          'targetAudience',
          'stylePreferences',
        ],
        minimumCompletenessScore: 60,
        maxIterations: ITERATION_LIMITS.discovery,
      };
    case 'research':
      return {
        phase,
        description: 'Research competitors and industry trends',
        minimumResults: 3,
        minimumRelevanceScore: 50,
        maxIterations: ITERATION_LIMITS.research,
      };
    case 'concept':
      return {
        phase,
        description: 'Generate and evaluate logo concepts',
        minimumConcepts: 3,
        minimumPassingScore: 7,
        maxIterations: ITERATION_LIMITS.concept,
      };
    case 'refinement':
      return {
        phase,
        description: 'Generate and refine SVG from approved concept',
        requiresApprovedConcept: true,
        minimumPassingScore: 8,
        maxIterations: ITERATION_LIMITS.refinement,
      };
    case 'export':
      return {
        phase,
        description: 'Export final logo in multiple formats',
        requiresApprovedSVG: true,
        maxIterations: ITERATION_LIMITS.export,
      };
  }
}

/**
 * Phase requirements for validation
 */
export interface PhaseRequirements {
  phase: AgentPhase;
  description: string;
  requiredFields?: string[];
  minimumCompletenessScore?: number;
  minimumResults?: number;
  minimumRelevanceScore?: number;
  minimumConcepts?: number;
  minimumPassingScore?: number;
  requiresApprovedConcept?: boolean;
  requiresApprovedSVG?: boolean;
  maxIterations: number;
}
