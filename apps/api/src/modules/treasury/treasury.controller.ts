import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { AppModule, User } from '@prisma/client';
import { RequireModule } from '../../core/guards/module.decorator';
import { TreasurySourceInputDto, TreasuryTargetInputDto } from './dto/treasury.dto';
import { TreasuryService } from './treasury.service';

@Controller('treasury')
@RequireModule(AppModule.treasury)
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get()
  overview() {
    return this.treasury.overview();
  }

  @Post('sources')
  createSource(@Req() req: { user: User }, @Body() body: TreasurySourceInputDto) {
    return this.treasury.saveSource(req.user, body);
  }

  @Put('sources/:id')
  updateSource(@Req() req: { user: User }, @Param('id') id: string, @Body() body: TreasurySourceInputDto) {
    return this.treasury.saveSource(req.user, body, id);
  }

  @Post('sources/:sourceId/targets')
  createTarget(@Req() req: { user: User }, @Param('sourceId') sourceId: string, @Body() body: TreasuryTargetInputDto) {
    return this.treasury.saveTarget(req.user, sourceId, body);
  }

  @Put('sources/:sourceId/targets/:id')
  updateTarget(
    @Req() req: { user: User }, @Param('sourceId') sourceId: string,
    @Param('id') id: string, @Body() body: TreasuryTargetInputDto,
  ) {
    return this.treasury.saveTarget(req.user, sourceId, body, id);
  }
}
