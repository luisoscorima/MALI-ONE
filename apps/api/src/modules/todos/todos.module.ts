import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

@Module({
  controllers: [TodosController, PortfolioController],
  providers: [TodosService, PortfolioService],
  exports: [TodosService, PortfolioService],
})
export class TodosModule {}
