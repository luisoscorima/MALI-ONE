import { Body, Controller, Get, Put } from '@nestjs/common';
import { AppModule } from '@prisma/client';
import { Public } from '../../../core/guards/public.decorator';
import { RequireModule } from '../../../core/guards/module.decorator';
import { PamWidgetsService } from '../pam/pam-widgets.service';
import { UpdateMuseoPopupDto } from '../dto/update-museo-popup.dto';

@Controller('widgets/museo')
export class MuseoWidgetsController {
  constructor(private readonly pam: PamWidgetsService) {}

  @Public()
  @Get('popup/config')
  getPopupPublicConfig() {
    return this.pam.getMuseoPopupPublicConfig();
  }

  @Put('popup')
  @RequireModule(AppModule.widget_pam)
  updatePopup(@Body() body: UpdateMuseoPopupDto) {
    return this.pam.updateMuseoPopup(body);
  }
}
