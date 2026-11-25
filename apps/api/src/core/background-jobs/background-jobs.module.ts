import { Global, Module } from '@nestjs/common';
import { BackgroundJobsService } from './background-jobs.service';
import { BackgroundJobsWorkerService } from './background-jobs.worker.service';

@Global()
@Module({
  providers: [BackgroundJobsService, BackgroundJobsWorkerService],
  exports: [BackgroundJobsService],
})
export class BackgroundJobsModule {}
