/**
 * Agent Session Durable Object
 *
 * Persists agent state across requests for a single logo generation session.
 * Each session has its own Durable Object instance identified by sessionId.
 */

import { DurableObject } from 'cloudflare:workers';
import type { AgentState, AgentAction, AgentPhase } from './types';
import { createAgentState, createAgentAction } from './types';
import { applyTransition, incrementIteration, validateTransition } from './state-machine';

/**
 * Request types for the Agent Session DO
 */
export interface AgentSessionRequest {
  action:
    | 'getState'
    | 'setState'
    | 'updateState'
    | 'transitionPhase'
    | 'incrementIteration'
    | 'logAction'
    | 'clearState';
  sessionId?: string;
  userId?: string;
  state?: Partial<AgentState>;
  phase?: AgentPhase;
  agentAction?: Omit<AgentAction, 'id' | 'timestamp'>;
}

/**
 * Response types for the Agent Session DO
 */
export interface AgentSessionResponse {
  success: boolean;
  state?: AgentState;
  error?: string;
}

/**
 * Agent Session Durable Object
 *
 * Stores and manages agent state for a single logo generation session.
 */
export class AgentSession extends DurableObject<Env> {
  private state: AgentState | null = null;

  /**
   * Handle incoming requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as AgentSessionRequest;
      const result = await this.handleRequest(body);
      return Response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return Response.json({ success: false, error: message }, { status: 500 });
    }
  }

  /**
   * Route requests to appropriate handlers
   */
  private async handleRequest(
    request: AgentSessionRequest
  ): Promise<AgentSessionResponse> {
    switch (request.action) {
      case 'getState':
        return this.getState();
      case 'setState':
        return this.setFullState(request.state as AgentState);
      case 'updateState':
        return this.updateState(request.state || {});
      case 'transitionPhase':
        return this.transitionPhase(request.phase!);
      case 'incrementIteration':
        return this.doIncrementIteration();
      case 'logAction':
        return this.logAction(request.agentAction!);
      case 'clearState':
        return this.clearState();
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  /**
   * Get current agent state
   */
  private async getState(): Promise<AgentSessionResponse> {
    // Load from storage if not in memory
    if (!this.state) {
      const stored = await this.ctx.storage.get<AgentState>('state');
      this.state = stored || null;
    }
    return { success: true, state: this.state || undefined };
  }

  /**
   * Set the full agent state
   */
  private async setFullState(state: AgentState): Promise<AgentSessionResponse> {
    if (!state) {
      return { success: false, error: 'State is required' };
    }

    this.state = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    await this.ctx.storage.put('state', this.state);
    return { success: true, state: this.state };
  }

  /**
   * Update partial agent state
   */
  private async updateState(
    updates: Partial<AgentState>
  ): Promise<AgentSessionResponse> {
    // Load current state if needed
    if (!this.state) {
      const stored = await this.ctx.storage.get<AgentState>('state');
      if (!stored) {
        return { success: false, error: 'No state to update' };
      }
      this.state = stored;
    }

    // Apply updates
    this.state = {
      ...this.state,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.ctx.storage.put('state', this.state);
    return { success: true, state: this.state };
  }

  /**
   * Transition to a new phase
   */
  private async transitionPhase(
    toPhase: AgentPhase
  ): Promise<AgentSessionResponse> {
    // Load current state if needed
    if (!this.state) {
      const stored = await this.ctx.storage.get<AgentState>('state');
      if (!stored) {
        return { success: false, error: 'No state to transition' };
      }
      this.state = stored;
    }

    // Validate transition
    const validation = validateTransition(this.state, toPhase);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Apply transition
    this.state = applyTransition(this.state, toPhase);
    await this.ctx.storage.put('state', this.state);
    return { success: true, state: this.state };
  }

  /**
   * Increment iteration count for current phase
   */
  private async doIncrementIteration(): Promise<AgentSessionResponse> {
    // Load current state if needed
    if (!this.state) {
      const stored = await this.ctx.storage.get<AgentState>('state');
      if (!stored) {
        return { success: false, error: 'No state to update' };
      }
      this.state = stored;
    }

    try {
      this.state = incrementIteration(this.state);
      await this.ctx.storage.put('state', this.state);
      return { success: true, state: this.state };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Log an action to history
   */
  private async logAction(
    action: Omit<AgentAction, 'id' | 'timestamp'>
  ): Promise<AgentSessionResponse> {
    // Load current state if needed
    if (!this.state) {
      const stored = await this.ctx.storage.get<AgentState>('state');
      if (!stored) {
        return { success: false, error: 'No state to log action' };
      }
      this.state = stored;
    }

    const fullAction = createAgentAction(action.phase, action.type, action.data);
    this.state = {
      ...this.state,
      history: [...this.state.history, fullAction],
      updatedAt: new Date().toISOString(),
    };
    await this.ctx.storage.put('state', this.state);
    return { success: true, state: this.state };
  }

  /**
   * Clear all state
   */
  private async clearState(): Promise<AgentSessionResponse> {
    this.state = null;
    await this.ctx.storage.delete('state');
    return { success: true };
  }
}

/**
 * Client for interacting with Agent Session Durable Objects
 */
export class AgentSessionClient {
  constructor(
    private namespace: DurableObjectNamespace<AgentSession>,
    private sessionId: string
  ) {}

  /**
   * Get the Durable Object stub for this session
   */
  private getStub(): DurableObjectStub<AgentSession> {
    const id = this.namespace.idFromName(this.sessionId);
    return this.namespace.get(id);
  }

  /**
   * Send a request to the Durable Object
   */
  private async request(
    body: AgentSessionRequest
  ): Promise<AgentSessionResponse> {
    const stub = this.getStub();
    const response = await stub.fetch('http://internal/agent-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  }

  /**
   * Get current state, creating if needed
   */
  async getOrCreateState(userId: string): Promise<AgentState> {
    const result = await this.request({ action: 'getState' });
    if (result.state) {
      return result.state;
    }

    // Create new state
    const newState = createAgentState(this.sessionId, userId);
    const setResult = await this.request({
      action: 'setState',
      state: newState,
    });
    if (!setResult.success || !setResult.state) {
      throw new Error(setResult.error || 'Failed to create state');
    }
    return setResult.state;
  }

  /**
   * Get current state (returns null if not exists)
   */
  async getState(): Promise<AgentState | null> {
    const result = await this.request({ action: 'getState' });
    return result.state || null;
  }

  /**
   * Update state with partial updates
   */
  async updateState(updates: Partial<AgentState>): Promise<AgentState> {
    const result = await this.request({ action: 'updateState', state: updates });
    if (!result.success || !result.state) {
      throw new Error(result.error || 'Failed to update state');
    }
    return result.state;
  }

  /**
   * Transition to a new phase
   */
  async transitionPhase(toPhase: AgentPhase): Promise<AgentState> {
    const result = await this.request({ action: 'transitionPhase', phase: toPhase });
    if (!result.success || !result.state) {
      throw new Error(result.error || 'Failed to transition phase');
    }
    return result.state;
  }

  /**
   * Increment iteration count for current phase
   */
  async incrementIteration(): Promise<AgentState> {
    const result = await this.request({ action: 'incrementIteration' });
    if (!result.success || !result.state) {
      throw new Error(result.error || 'Failed to increment iteration');
    }
    return result.state;
  }

  /**
   * Log an action to history
   */
  async logAction(
    phase: AgentPhase,
    type: AgentAction['type'],
    data: Record<string, unknown>
  ): Promise<AgentState> {
    const result = await this.request({
      action: 'logAction',
      agentAction: { phase, type, data },
    });
    if (!result.success || !result.state) {
      throw new Error(result.error || 'Failed to log action');
    }
    return result.state;
  }

  /**
   * Clear all state for this session
   */
  async clearState(): Promise<void> {
    const result = await this.request({ action: 'clearState' });
    if (!result.success) {
      throw new Error(result.error || 'Failed to clear state');
    }
  }
}
