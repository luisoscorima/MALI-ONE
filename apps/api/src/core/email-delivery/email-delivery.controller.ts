import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../guards/roles.decorator';
import { EmailDeliveryService } from './email-delivery.service';
import { SaveEmailSenderDto } from './email-sender.dto';
import { EmailSenderService } from './email-sender.service';
import { SesEventConsumerService } from './ses-event-consumer.service';

const SIMULATOR_ADDRESSES = {
  success: 'success@simulator.amazonses.com',
  bounce: 'bounce@simulator.amazonses.com',
  complaint: 'complaint@simulator.amazonses.com',
} as const;

type SimulatorScenario = keyof typeof SIMULATOR_ADDRESSES;

/** Administrative diagnostics for the shared transport, independent of CRM modules. */
@Controller('email-delivery')
@Roles(UserRole.admin)
export class EmailDeliveryController {
  constructor(
    private readonly delivery: EmailDeliveryService,
    private readonly events: SesEventConsumerService,
    private readonly senders: EmailSenderService,
  ) {}

  @Get('status')
  status() {
    return {
      delivery: this.delivery.status,
      events: this.events.status,
    };
  }

  @Get('senders')
  listSenders() {
    return this.senders.list();
  }

  @Post('senders')
  createSender(@Body() body: SaveEmailSenderDto) {
    return this.senders.create(body.email);
  }

  @Patch('senders/:id')
  updateSender(@Param('id') id: string, @Body() body: SaveEmailSenderDto) {
    return this.senders.update(id, body.email);
  }

  @Delete('senders/:id')
  removeSender(@Param('id') id: string) {
    return this.senders.remove(id);
  }

  @Post('simulator/:scenario')
  async simulator(@Param('scenario') scenario: string) {
    if (!(scenario in SIMULATOR_ADDRESSES)) {
      throw new BadRequestException(
        `Escenario inválido; usa ${Object.keys(SIMULATOR_ADDRESSES).join(', ')}`,
      );
    }
    const selected = scenario as SimulatorScenario;
    const result = await this.delivery.sendHtml({
      to: SIMULATOR_ADDRESSES[selected],
      subject: `MALI ONE SES test: ${selected}`,
      html: `<p>Prueba controlada del motor SES compartido: <strong>${selected}</strong>.</p>`,
      tags: { source: 'mali-one-test', scenario: selected },
    });
    return { scenario: selected, ...result };
  }
}
