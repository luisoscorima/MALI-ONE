import { Body, Controller, Get, Put } from '@nestjs/common';
import { Public } from '../../../core/guards/public.decorator';
import { RequirePermission } from '../../../core/guards/permission.decorator';
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

  @Get('popup')
  @RequirePermission('widgets.museo.popup.manage')
  getPopupAdmin() {
    return this.pam.getMuseoPopupAdmin();
  }

  @Put('popup')
  @RequirePermission('widgets.museo.popup.manage')
  updatePopup(@Body() body: UpdateMuseoPopupDto) {
    return this.pam.updateMuseoPopup(body);
  }
}
