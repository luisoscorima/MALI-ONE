import { BadRequestException, Body, Controller, Get, Param, Post, Put, Req, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppModule, User } from '@prisma/client';
import { RequireModule } from '../../core/guards/module.decorator';
import { TreasurySourceInputDto, TreasuryTargetInputDto, TreasuryPaymentQueryDto, MercadoPagoPaymentQueryDto } from './dto/treasury.dto';
import { TreasuryPaymentsService } from './treasury-payments.service';
import { TreasuryService } from './treasury.service';
import { NiubizSyncService } from './niubiz-sync.service';
import { Roles } from '../../core/guards/roles.decorator';
import { MercadoPagoSyncService } from './mercadopago-sync.service';

@Controller('treasury')
@RequireModule(AppModule.treasury)
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService, private readonly payments: TreasuryPaymentsService,
    private readonly niubiz: NiubizSyncService, private readonly mercadoPago: MercadoPagoSyncService) {}

  @Get('mercadopago/:sourceId/status')
  mercadoPagoStatus(@Param('sourceId') sourceId: string) { return this.mercadoPago.status(sourceId); }

  @Post('mercadopago/:sourceId/sync')
  @Roles('admin')
  syncMercadoPago(@Req() req: { user: User }, @Param('sourceId') sourceId: string, @Body() body: MercadoPagoPaymentQueryDto) {
    return this.mercadoPago.start(sourceId, { from: body.from, to: body.to }, req.user);
  }

  @Get('mercadopago/:sourceId/payments')
  mercadoPagoPayments(@Param('sourceId') sourceId: string, @Query() query: MercadoPagoPaymentQueryDto) {
    return this.mercadoPago.list(sourceId, query);
  }

  @Get('niubiz/status')
  niubizStatus() { return this.niubiz.status(); }

  @Post('niubiz/sync')
  @Roles('admin')
  syncNiubiz(@Req() req: { user: User }, @Body() body: TreasuryPaymentQueryDto) {
    return this.niubiz.start({ from: body.from, to: body.to }, req.user);
  }

  @Get('payments')
  listPayments(@Query() query: TreasuryPaymentQueryDto) { return this.payments.list(query); }

  @Post('payments/import-niubiz')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  importNiubiz(@Req() req: { user: User }, @UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer || !file.originalname.toLowerCase().endsWith('.xlsx')) throw new BadRequestException('Selecciona el exportado XLSX de Niubiz.');
    return this.payments.importXlsx(req.user, file.buffer);
  }

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
