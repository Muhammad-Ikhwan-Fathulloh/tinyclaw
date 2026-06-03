import type { HealthResponse, LlmUsageStatus, SystemStatusResponse } from "@tinyclaw/core";
import { getTelegramWorkerStatus, TINYCLAW_API_VERSION } from "@tinyclaw/core";
import type { AgentService } from "./agent-service";
import type { AutomationRunner } from "./automation-runner";
import type { AutomationScheduler } from "./automation-scheduler";
import type { TaskRunner } from "./task-runner";

export class SystemStatusService {
  constructor(
    private readonly agent: AgentService,
    private readonly scheduler: AutomationScheduler,
    private readonly automationRunner: AutomationRunner,
    private readonly taskRunner: TaskRunner,
  ) {}

  async getStatus(): Promise<SystemStatusResponse> {
    const scheduler = this.scheduler.getStatus();
    const providerConfigured = this.agent.providerConfigured;
    const models = await this.agent.getModels();
    const usageFields = this.agent.getUsageStatusFields();

    return {
      server: this.getServerStatus(),
      automationWorker: {
        ok: scheduler.running,
        running: scheduler.running,
        scheduledJobs: scheduler.scheduledJobs,
        activeRuns: this.automationRunner.getActiveRunCount(),
        providerConfigured,
      },
      taskWorker: {
        ok: true,
        activeRuns: this.taskRunner.getActiveRunCount(),
        providerConfigured,
      },
      telegramWorker: await getTelegramWorkerStatus(),
      llmUsage: this.getLlmUsage(
        models.provider,
        models.currentModel,
        providerConfigured,
        usageFields,
      ),
      checkedAt: new Date().toISOString(),
    };
  }

  private getLlmUsage(
    provider: LlmUsageStatus["provider"],
    currentModel: string | null,
    providerConfigured: boolean,
    usageFields: { displayName: string | null; costEstimated: boolean },
  ): LlmUsageStatus {
    return {
      ...this.agent.getLlmUsageStats(),
      provider,
      currentModel,
      providerConfigured,
      displayName: usageFields.displayName,
      costEstimated: usageFields.costEstimated,
    };
  }

  private getServerStatus(): HealthResponse {
    return {
      ok: true,
      apiVersion: TINYCLAW_API_VERSION,
      providerConfigured: this.agent.providerConfigured,
    };
  }
}
