import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  RELATORIOS_QUEUE,
  RelatoriosService,
  type ExportJobData,
  type ExportJobResultado,
} from './relatorios.service';

@Processor(RELATORIOS_QUEUE)
export class RelatoriosProcessor extends WorkerHost {
  private readonly logger = new Logger(RelatoriosProcessor.name);

  constructor(private readonly service: RelatoriosService) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<ExportJobResultado> {
    this.logger.log(`[job ${job.id}] Iniciando export de submissões`);
    return this.service.executarExport(job);
  }
}
