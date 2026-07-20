import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { AppModule } from '@prisma/client';
import type { Response } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import { BsaleExportService } from './bsale-export.service';
import { BsaleKardexService } from './bsale-kardex.service';
import { KardexExportDto, KardexQueryDto } from './dto/kardex-query.dto';

@Controller('bsale')
@RequireModule(AppModule.bsale_reports)
export class BsaleController {
  constructor(
    private readonly kardex: BsaleKardexService,
    private readonly exportService: BsaleExportService,
  ) {}

  @Get('offices')
  listOffices() {
    return this.kardex.listOffices();
  }

  @Post('kardex')
  buildKardex(@Body() body: KardexQueryDto) {
    return this.kardex.startOrPollKardex({
      from: body.from,
      to: body.to,
      officeIds: body.officeIds,
    });
  }

  @Post('kardex/export')
  async exportKardex(@Body() body: KardexExportDto, @Res() res: Response) {
    const result = await this.kardex.buildKardex({
      from: body.from,
      to: body.to,
      officeIds: body.officeIds,
    });

    const stamp = `${body.from}_${body.to}`;
    if (body.format === 'csv') {
      const buffer = this.exportService.toCsv(result.movements);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="kardex_bsale_${stamp}.csv"`,
      );
      return res.send(buffer);
    }

    const buffer = await this.exportService.toXlsx(result.movements);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="kardex_bsale_${stamp}.xlsx"`,
    );
    return res.send(buffer);
  }
}
